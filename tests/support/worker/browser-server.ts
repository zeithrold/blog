import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Runtime, RuntimeFailure } from './runtime'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import process from 'node:process'
import { runtime } from './runtime'
import { scenario } from './scenario'

// This disposable Access gateway is only a test entry point and is absent from the Worker build.
function gatewayHeaders(incoming: IncomingMessage, token: string) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value !== undefined) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value)
    }
  }
  headers.delete('cf-access-jwt-assertion')
  if ((headers.get('cookie') ?? '').split('; ').includes('fixture=browser-test')) {
    headers.set('cf-access-jwt-assertion', token)
  }
  return headers
}
type GatewayContext = Runtime & { tokenCreatedAt: number }
const SIGNALS = ['SIGINT', 'SIGTERM'] as const
type GatewayOptions = { port: number, prewarm: boolean }
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

// Owns every Worker runtime the gateway builds: one active case, at most one warm spare, and the
// serialized swap between them. Failures are never swallowed: a build that fails surfaces at the
// reset that waits for it, and shutdown reports whatever is left.
class FixturePool {
  readonly #origin: string
  readonly #fault: Fault
  readonly #live = new Set<GatewayContext>()
  #builds = 0
  #disposeFailures: number
  #closing = false
  #active: GatewayContext | undefined
  #spare: Promise<GatewayContext> | undefined
  #queue: Promise<void> = Promise.resolve()
  #closePromise: Promise<void> | undefined

  constructor(origin: string, faultRule: Fault) {
    this.#origin = origin
    this.#fault = faultRule
    this.#disposeFailures = faultRule.dispose
  }

  active(): GatewayContext {
    if (this.#active === undefined) {
      throw new Error('Fixture is not started')
    }
    return this.#active
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
    for (const target of retained) {
      try {
        await this.#dispose(target)
        this.#live.delete(target)
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

  async #build(): Promise<GatewayContext> {
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
    const created = { ...await runtime(this.#origin, undefined, failure), tokenCreatedAt: Date.now() }
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

  async #retire(target: GatewayContext): Promise<void> {
    // Forgetting a Worker before it is actually disposed would let a failure go unreported.
    await this.#dispose(target)
    this.#live.delete(target)
  }
}

function route(
  fixtures: FixturePool,
  options: GatewayOptions,
  incoming: IncomingMessage,
  outgoing: ServerResponse,
): void {
  if (incoming.url === '/__fixture/scenario') {
    scenario(fixtures.active(), incoming, outgoing).catch((error: unknown) => {
      console.error(error)
      outgoing.writeHead(500).end('Local scenario failed')
    })
    return
  }
  const request = new URL(incoming.url ?? '/', `http://127.0.0.1:${options.port}`)
  if (request.pathname === '/__fixture/health') {
    outgoing.writeHead(200, { 'content-type': 'application/json' })
    outgoing.end(JSON.stringify({ fixture: 'browser-server', pid: process.pid, port: options.port }))
    return
  }
  if (request.pathname === '/__fixture/reset') {
    if (incoming.method !== 'POST' || incoming.headers.host !== `127.0.0.1:${options.port}`
      || incoming.headers['sec-fetch-site'] === 'cross-site') {
      outgoing.writeHead(403)
      outgoing.end()
      return
    }
    // CPU-throttled measurement runs must not share the machine with a background build.
    const prewarm = options.prewarm && request.searchParams.get('project') !== 'performance'
    fixtures.reset(prewarm).then(() => {
      outgoing.writeHead(204)
      outgoing.end()
    }).catch((error: unknown) => {
      console.error(error)
      outgoing.writeHead(500)
      outgoing.end('Local fixture reset failed')
    })
    return
  }
  gateway(fixtures.active(), incoming, outgoing).catch((error: unknown) => {
    console.error(error)
    outgoing.writeHead(500)
    outgoing.end('Local fixture failed')
  })
}

async function main(): Promise<void> {
  const port = Number(process.env.BLOG_TEST_PORT ?? 8801)
  const options = {
    port,
    prewarm: process.env.BLOG_FIXTURE_PREWARM !== '0',
  }
  const fixtures = new FixturePool(
    `http://127.0.0.1:${port}`,
    fault(process.env.BLOG_FIXTURE_FAULT),
  )
  // Miniflare's exit hook (src/exit-hook.ts) registers SIGINT/SIGTERM listeners that call
  // `process.exit(128 + signal)` synchronously, which would kill the gateway before its
  // asynchronous cleanup finishes. Only the listeners its Workers add are dropped; anything the
  // surrounding process installed stays in place.
  const inherited = SIGNALS.map(signal => [
    signal,
    new Set(process.listeners(signal)),
  ] as const)
  // The first case builds its own Worker; later cases get one prewarmed during the previous case.
  await fixtures.start()
  for (const [signal, listeners] of inherited) {
    for (const listener of process.listeners(signal)) {
      if (!listeners.has(listener)) {
        process.removeListener(signal, listener)
      }
    }
  }
  const server = createServer((incoming, outgoing) => {
    route(fixtures, options, incoming, outgoing)
  })
  server.listen(port, '127.0.0.1')
  let shuttingDown = false
  const shutdown = (): void => {
    // The guard is synchronous: a second signal must not start (or finish) another exit.
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    server.close()
    fixtures.close().then(() => process.exit(0), (error: unknown) => {
      console.error(error)
      process.exit(1)
    })
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

async function gateway(context: GatewayContext, incoming: IncomingMessage, outgoing: ServerResponse) {
  if (incoming.url === '/__fixture/login') {
    outgoing.writeHead(302, {
      'location': '/admin',
      'set-cookie': 'fixture=browser-test; HttpOnly; SameSite=Strict; Path=/',
    })
    outgoing.end()
    return
  }
  if (Date.now() - context.tokenCreatedAt > 600000) {
    context.token = await context.jwt()
    context.tokenCreatedAt = Date.now()
  }
  const parts = []
  let size = 0
  for await (const chunk of incoming) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    size += part.length
    if (size > 67108864) {
      throw new Error('Test body exceeds 64 MiB')
    }
    parts.push(part)
  }
  const response = await context.fixture.dispatchFetch(
    new URL(incoming.url ?? '/', context.origin),
    {
      method: incoming.method,
      headers: Object.fromEntries(gatewayHeaders(incoming, context.token)),
      body: parts.length > 0 ? Buffer.concat(parts) : undefined,
      redirect: 'manual',
    },
  )
  outgoing.writeHead(response.status, Object.fromEntries(response.headers))
  outgoing.end(Buffer.from(await response.arrayBuffer()))
}
main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
