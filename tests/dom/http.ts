/*
 * The HTTP boundary of the DOM layer: the real client, controller and React, with
 * only `fetch` replaced by this case's handler table.
 *
 * A product response is never invented: every reply comes from a handler the case
 * declares, and every request the surface issues is recorded. A request no case
 * described is answered with a problem response and reported by `expectServed()`,
 * so missing coverage fails instead of quietly rendering an empty surface.
 * Handlers are keyed `METHOD /path/:id`, with generated identifiers normalised so
 * a case describes the route rather than one run's UUID.
 *
 * This is the jsdom counterpart of `tests/components/support/http-fixtures.ts`:
 * the same table semantics, routed at the `fetch` boundary a jsdom surface reads.
 */

export type ApiReply = { status?: number, body?: unknown, abort?: 'failed' }
export type ApiCall = {
  readonly method: string
  readonly path: string
  readonly query: URLSearchParams
  /** Parsed request body, `undefined` when the request had none. */
  readonly json: unknown
  readonly headers: Record<string, string>
}
export type ApiHandler = (call: ApiCall) => ApiReply | Promise<ApiReply>
export type ApiService = {
  readonly calls: ApiCall[]
  readonly unhandled: string[]
  /** Waits for every answered request and reports a failed delivery. */
  settle: () => Promise<void>
  /** Settles and requires every request to have matched a handler. */
  expectServed: () => Promise<void>
  /** Restores the host `fetch`; never throws, so a `finally` can call it. */
  dispose: () => void
}

const identifier = /[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/gi

/** `POST /api/admin/documents/:id/restore-deleted`: the key a handler table uses. */
export function apiKey(method: string, path: string): string {
  return `${method} ${path.replace(identifier, ':id')}`
}

/** A JSON problem body, as the admin API reports a refused operation. */
export function failure(status: number, code: string, issues?: string[]): ApiReply {
  return { status, body: issues === undefined ? { code } : { code, issues } }
}

/** The server committed the request but the response never reached the browser. */
export function lostResponse(): ApiReply {
  return { abort: 'failed' }
}

export type Held = {
  readonly promise: Promise<void>
  /** Idempotent, so a `finally` can call it after the body already released. */
  readonly open: () => void
}

/** A hold a case releases explicitly; `finally` opens it so no request stays pending. */
export function defer(): Held {
  let open: () => void = () => {}
  const promise = new Promise<void>((resolve) => {
    open = resolve
  })
  return { promise, open: () => open() }
}

type FetchInput = URL | Request | string

/**
 * One installed table and everything its case must answer for.
 *
 * The layer owns this boundary, not the case's last line: teardown drains what is
 * still in flight, reports a request no case declared, a handler that threw and a
 * table left installed, then restores the host `fetch`. A case therefore cannot
 * pass by never reaching `expectServed()`.
 */
type Opened = {
  /** The host `fetch` this table replaced, restored when this table goes away. */
  readonly original: typeof fetch
  /** The table's own `fetch`, so a restore never clobbers a newer table. */
  readonly stub: typeof fetch
  readonly running: Set<Promise<void>>
  readonly unhandled: string[]
  readonly failed: unknown[]
  /** False once the case disposed it; a closed table must never answer again. */
  open: boolean
}

/** Installed tables in install order: the newest open one is the live boundary. */
const opened: Opened[] = []

/**
 * The boundary the host should expose right now.
 *
 * The newest open table wins. With none open, the bottom table's captured
 * `fetch` is native again — never a closed sibling's stub, which is how an
 * out-of-order dispose used to resurrect an earlier table.
 */
function effectiveFetch(): typeof fetch {
  for (let index = opened.length - 1; index >= 0; index--) {
    const entry = opened[index]
    if (entry !== undefined && entry.open) {
      return entry.stub
    }
  }
  const bottom = opened[0]
  return bottom === undefined ? globalThis.fetch : bottom.original
}

function close(entry: Opened): void {
  if (!entry.open) {
    return
  }
  entry.open = false
  globalThis.fetch = effectiveFetch()
}

/**
 * The real timer. `until` and the teardown deadline must not be suspended by a
 * case's fake timers, or a leak would hang the suite instead of failing it.
 */
const realSetTimeout = globalThis.setTimeout.bind(globalThis)

async function waitReal(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    realSetTimeout(resolve, ms)
  })
}

function describeFailure(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return 'a handler threw a value that is not an error'
}

/**
 * Settles every request this table still trusts, bounded by real time.
 *
 * A handler a case never released must fail that case, not hang the next one, so
 * a table that does not converge is reported instead of awaited forever.
 */
async function drain(entry: Opened, deadline = 4000): Promise<boolean> {
  const started = Date.now()
  while (entry.running.size > 0) {
    const remaining = deadline - (Date.now() - started)
    if (remaining <= 0) {
      return false
    }
    const inFlight = Promise.allSettled(Array.from(entry.running)).then(() => true)
    const timedOut = waitReal(remaining).then(() => false)
    const settled = await Promise.race([inFlight, timedOut])
    if (!settled) {
      return false
    }
  }
  return true
}

/** Problems the layer must fail on once a case ends, in the order they occurred. */
export async function outstandingFetchProblems(): Promise<string[]> {
  const problems: string[] = []
  const entries = Array.from(opened)
  for (const entry of entries) {
    if (!await drain(entry)) {
      problems.push('a request never settled before the case ended')
    }
    problems.push(...entry.unhandled.map(key => `a request had no declared handler: ${key}`))
    problems.push(...entry.failed.map(error => `a fixture handler threw: ${describeFailure(error)}`))
    if (entry.open) {
      problems.push('a served fetch table was never disposed')
    }
  }
  return problems
}

/**
 * Restores the host `fetch` for every table still installed and forgets them.
 *
 * Restores run last-in, first-out, and the bottom table's captured `fetch` is set
 * last, so the boundary always ends on the native implementation even if a case
 * disposed out of order. Clearing the record is what stops a later case from
 * being answered by an earlier case's table.
 */
export function resetFetchBoundary(): void {
  const bottom = opened[0]
  for (const entry of opened) {
    entry.open = false
  }
  if (bottom !== undefined) {
    globalThis.fetch = bottom.original
  }
  opened.length = 0
}

/** The sentinel a declared transport abort travels on, never recorded. */
const DECLARED_TRANSPORT = new Error('declared transport failure')

type Pending = {
  readonly calls: ApiCall[]
  readonly unhandled: string[]
  readonly running: Set<Promise<void>>
  readonly failed: unknown[]
}

function absoluteUrl(input: FetchInput): URL {
  if (input instanceof URL) {
    return input
  }
  if (input instanceof Request) {
    return new URL(input.url)
  }
  return new URL(input, window.location.href)
}

function headerRecord(headers: HeadersInit | undefined): Record<string, string> {
  const record: Record<string, string> = {}
  if (headers === undefined) {
    return record
  }
  const entries = Array.isArray(headers)
    ? headers
    : Array.from(new Headers(headers).entries())
  for (const [name, value] of entries) {
    record[name.toLowerCase()] = value
  }
  return record
}

function parseBody(value: unknown): unknown {
  if (typeof value !== 'string' || value === '') {
    return undefined
  }
  try {
    return JSON.parse(value)
  }
  catch {
    return value
  }
}

async function readCall(input: FetchInput, init: RequestInit | undefined): Promise<ApiCall> {
  const request = input instanceof Request ? input : undefined
  const url = absoluteUrl(input)
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
  const body = request === undefined
    ? parseBody(init?.body)
    : parseBody(await request.clone().text())
  return {
    method,
    path: url.pathname,
    query: url.searchParams,
    json: body,
    headers: { ...headerRecord(request?.headers), ...headerRecord(init?.headers) },
  }
}

function responseFor(reply: ApiReply): Response {
  return new Response(JSON.stringify(reply.body ?? null), {
    status: reply.status ?? 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** A declared transport failure is the only rejection a fixture may hand over. */
function declaredTransportFailure(): Error {
  return new TypeError('fetch failed')
}

/**
 * Routes the surface's traffic to this case's handlers and records every request.
 *
 * The whole request is tracked from the moment it enters, including a body read
 * that never resolves: a case that starts a held request and never awaits it must
 * fail at teardown instead of escaping into the next case. Every failure that is
 * not the declared transport abort is recorded — a body stream that fails on a
 * closed table and a reply the `Response` constructor refuses are both fixture
 * failures, so a case cannot pass with `guard: []`.
 */
function routeFetch(
  table: Readonly<Record<string, ApiHandler>>,
  state: Pending,
): typeof fetch {
  return async (input, init) => {
    const task = (async (): Promise<Response> => {
      let reply: ApiReply
      try {
        const call = await readCall(input, init)
        state.calls.push(call)
        const key = apiKey(call.method, call.path)
        const handler = table[key]
        if (handler === undefined) {
          state.unhandled.push(key)
          return responseFor(failure(500, 'UNHANDLED_FIXTURE_REQUEST'))
        }
        reply = await handler(call)
        if (reply.abort !== undefined) {
          // Tolerated by declaration: a transport failure the case asked for.
          throw DECLARED_TRANSPORT
        }
        return responseFor(reply)
      }
      catch (error: unknown) {
        if (error === DECLARED_TRANSPORT) {
          throw declaredTransportFailure()
        }
        state.failed.push(error)
        throw error
      }
    })()
    // Tracking never rejects, so a drain cannot report the case's own failure twice.
    const tracked = task.then(() => {}, () => {})
    state.running.add(tracked)
    try {
      return await task
    }
    finally {
      state.running.delete(tracked)
    }
  }
}

/**
 * Routes the surface's traffic to this case's handlers and records every request.
 * The returned service is the only handle on the host `fetch` while it is open.
 */
export function serveFetch(table: Readonly<Record<string, ApiHandler>>): ApiService {
  const original = globalThis.fetch
  const state: Pending = { calls: [], unhandled: [], running: new Set(), failed: [] }
  const stub = routeFetch(table, state)
  const entry: Opened = {
    original,
    stub,
    running: state.running,
    unhandled: state.unhandled,
    failed: state.failed,
    open: true,
  }
  opened.push(entry)
  globalThis.fetch = stub
  const settle = async (): Promise<void> => {
    await drain(entry)
    const first = state.failed[0]
    if (first !== undefined) {
      throw first instanceof Error ? first : new Error('A fixture handler failed')
    }
  }
  return {
    calls: state.calls,
    unhandled: state.unhandled,
    settle,
    expectServed: async () => {
      await settle()
      if (state.unhandled.length > 0) {
        throw new Error(`The surface sent requests no case described: ${state.unhandled.join(', ')}`)
      }
    },
    dispose: () => {
      close(entry)
    },
  }
}
