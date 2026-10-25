import type { Runtime, RuntimeFailure } from './runtime'
import { setTimeout as delay } from 'node:timers/promises'
import { runtime } from './runtime'

// The Worker a request is served by, plus the Access assertion minted for it.
export type GatewayContext = Runtime & { tokenCreatedAt: number }
// A request's hold on a Worker: it stays leased from `rent()` until `release()`.
export type Lease = { context: GatewayContext, release: () => void }
// How long a retirement waits for the responses its Worker is still delivering. A client that
// stopped reading must delay a reset or a shutdown, never hang it.
const RETIRE_GRACE_MS = 10000

// `BLOG_FIXTURE_FAULT` injects one failure so the cleanup paths stay covered: `build:<n>` fails
// the nth build before a Worker exists, `runtime:<n>:<stage>` fails after it has been allocated,
// and `dispose` fails the next disposal.
type Fault = { at: number, stage?: RuntimeFailure, dispose: number }
function fault(value: string | undefined): Fault {
  const [kind, at, stage] = (value ?? '').split(':')
  const index = Number(at)
  if (kind === 'dispose') {
    return { at: 0, dispose: 1 }
  }
  if (!Number.isSafeInteger(index) || index < 1) {
    return { at: 0, dispose: 0 }
  }
  if (kind === 'build') {
    return { at: index, dispose: 0 }
  }
  if (kind === 'runtime' && (stage === 'ready' || stage === 'migrate')) {
    return { at: index, stage, dispose: 0 }
  }
  return { at: 0, dispose: 0 }
}

// A build or reset cancelled by the gateway's own shutdown is not a failure of the case.
class FixtureShutdown extends Error {}

// Resolves to `true` once `promise` settles and to `false` after `ms`, so a wait is bounded without
// keeping the process alive for a grace period nobody is waiting on any more.
async function within(promise: Promise<void>, ms: number): Promise<boolean> {
  return await Promise.race([
    promise.then(() => true),
    delay(ms, undefined, { ref: false }).then(() => false),
  ])
}

// One built Worker and the requests that are still using it. A request takes a lease before it
// dispatches and releases it once its response has been handed to the client; disposing a Worker
// with a response still open terminates that connection mid-body, which is how one case boundary
// used to take the whole gateway down with it (`UNDICI terminated`, then a second head).
class FixtureWorker {
  readonly context: GatewayContext
  #inFlight = 0
  #retired = false
  #waiting: (() => void) | undefined
  #idle: Promise<void> | undefined

  constructor(context: GatewayContext) {
    this.context = context
  }

  // Callers release the lease once their response is complete. `undefined` means the Worker is
  // already retiring, so the request must not be dispatched to it at all.
  lease(): (() => void) | undefined {
    if (this.#retired) {
      return undefined
    }
    this.#inFlight += 1
    let released = false
    return () => {
      if (released) {
        return
      }
      released = true
      this.#inFlight -= 1
      if (this.#inFlight === 0) {
        this.#waiting?.()
      }
    }
  }

  // Takes no new leases and returns what the running requests still have to finish, so the caller
  // can wait for them before disposing.
  retire(): Promise<void> | undefined {
    this.#retired = true
    if (this.#inFlight === 0) {
      return undefined
    }
    this.#idle ??= new Promise<void>((resolve) => {
      this.#waiting = resolve
    })
    return this.#idle
  }
}

// Owns every Worker runtime the gateway builds: one active case, at most one warm spare, and the
// serialized swap between them. Failures are never swallowed: a build that fails surfaces at the
// reset that waits for it, and shutdown reports whatever is left.
export class FixturePool {
  readonly #origin: string
  readonly #fault: Fault
  readonly #live = new Set<FixtureWorker>()
  #builds = 0
  #disposeFailures: number
  #closing = false
  #active: FixtureWorker | undefined
  #spare: Promise<FixtureWorker> | undefined
  #queue: Promise<void> = Promise.resolve()
  #closePromise: Promise<void> | undefined

  constructor(origin: string, failure?: string) {
    this.#origin = origin
    this.#fault = fault(failure)
    this.#disposeFailures = this.#fault.dispose
  }

  // Every request serves from a lease of the active Worker, and a swap of that lease for a disposal
  // is the only place that decides when a Worker may go away.
  rent(): Lease {
    if (this.#active === undefined) {
      throw new Error('Fixture is not started')
    }
    const release = this.#active.lease()
    if (release === undefined) {
      throw new Error('Fixture Worker is retiring')
    }
    return { context: this.#active.context, release }
  }

  async start(): Promise<void> {
    this.#active = await this.#build()
  }

  async reset(prewarm: boolean): Promise<void> {
    if (this.#closing) {
      throw new FixtureShutdown('Fixture gateway is shutting down')
    }
    const done = this.#queue.then(async () => await this.#swap(prewarm), async () => await this.#swap(prewarm))
    this.#queue = done.then(() => undefined, () => undefined)
    return await done
  }

  async close(): Promise<void> {
    // One shutdown per gateway: every caller observes the same drain, so a second signal can
    // never return (and let the process exit) while the first is still cleaning up.
    this.#closePromise ??= this.#drain()
    return await this.#closePromise
  }

  async #drain(): Promise<void> {
    this.#closing = true
    // Swaps accepted before closing settle here, including the retirements they perform.
    await this.#queue
    const spare = this.#spare
    this.#spare = undefined
    const failures: unknown[] = []
    if (spare !== undefined) {
      try {
        await spare
      }
      catch (error) {
        if (!(error instanceof FixtureShutdown)) {
          failures.push(error)
        }
      }
    }
    const retained = [
      ...this.#live,
    ]
    for (const worker of retained) {
      try {
        await this.#retire(worker)
      }
      catch (error) {
        failures.push(error)
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, 'Fixture gateway did not shut down cleanly')
    }
  }

  async #swap(prewarm: boolean): Promise<void> {
    const pending = this.#spare
    this.#spare = undefined
    // A spare that failed is a failure of this reset in either mode; only a built Worker is usable.
    const spare = pending === undefined ? undefined : await pending
    if (!prewarm && spare !== undefined) {
      await this.#retire(spare)
    }
    const replacement = prewarm && spare !== undefined ? spare : await this.#build()
    const previous = this.#active
    this.#active = replacement
    // The previous case keeps answering the requests it is already delivering, but takes no new
    // ones: from here on every request lands on the replacement.
    if (previous !== undefined) {
      await this.#retire(previous)
    }
    if (prewarm) {
      this.#warm()
    }
  }

  #warm(): void {
    if (this.#closing) {
      return
    }
    const spare = this.#build()
    // A failed spare is reported by the next reset or by close(), never as an unhandled rejection.
    spare.catch(() => undefined)
    this.#spare = spare
  }

  async #build(): Promise<FixtureWorker> {
    if (this.#closing) {
      throw new FixtureShutdown('Fixture gateway is shutting down')
    }
    this.#builds += 1
    const index = this.#builds
    if (this.#fault.at === index && this.#fault.stage === undefined) {
      throw new Error(`Injected fixture build failure (BLOG_FIXTURE_FAULT=build:${index})`)
    }
    const failure = this.#fault.at === index ? this.#fault.stage : undefined
    // A build that finishes during shutdown is kept in `live` and disposed by `#drain`; it is
    // not a failure, and refusing it earlier keeps shutdown from starting pointless work.
    const created = new FixtureWorker({
      ...await runtime(this.#origin, undefined, failure),
      tokenCreatedAt: Date.now(),
    })
    this.#live.add(created)
    return created
  }

  async #dispose(target: GatewayContext): Promise<void> {
    if (this.#disposeFailures > 0) {
      this.#disposeFailures -= 1
      throw new Error('Injected fixture dispose failure (BLOG_FIXTURE_FAULT=dispose)')
    }
    await target.dispose()
  }

  async #retire(worker: FixtureWorker): Promise<void> {
    // The Worker stops taking requests immediately, but the responses it is already delivering
    // finish first: every request leases the Worker it dispatches to, so a reset, a replacement and
    // the shutdown all dispose only once those leases are gone.
    const running = worker.retire()
    if (running !== undefined && !await within(running, RETIRE_GRACE_MS)) {
      console.error(`Fixture Worker still served a response after ${RETIRE_GRACE_MS}ms; disposing it`)
    }
    // Forgetting a Worker before it is actually disposed would let a failure go unreported.
    await this.#dispose(worker.context)
    this.#live.delete(worker)
  }
}
