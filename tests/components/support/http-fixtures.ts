import type { Page, Route } from '@playwright/test'

/**
 * The HTTP boundary the component browser specs own.
 *
 * A component surface runs the real component, controller and client, so every
 * response it reads comes from a case's handler table and every request it writes
 * is recorded for assertions. Nothing here replaces a component, model or client.
 *
 * Handlers are keyed `METHOD /path/:id`, with generated identifiers normalised so
 * a case describes the route rather than one run's UUID.
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
  /** Never-throwing drain for `finally` blocks. */
  dispose: () => Promise<void>
}

const identifier = /[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/gi

/** `POST /api/admin/documents/:id/restore-deleted`: the key a handler table uses. */
export function apiKey(method: string, path: string): string {
  return `${method} ${path.replace(identifier, ':id')}`
}

/** A JSON problem body, as the admin API reports a refused operation. */
export function failure(status: number, code: string): ApiReply {
  return { status, body: { code } }
}

/**
 * The server committed the request but the response never reached the browser,
 * which is the transport failure the retry paths have to survive.
 */
export function lostResponse(): ApiReply {
  return { abort: 'failed' }
}

/**
 * Routes the surface's API traffic to this case's handlers and records every
 * request. Anything a case did not describe is answered with a problem response
 * and reported by `expectServed()`, so missing coverage fails instead of quietly
 * rendering whatever the static server would have returned.
 */
export async function serveApi(
  page: Page,
  table: Readonly<Record<string, ApiHandler>>,
): Promise<ApiService> {
  const pattern = '**/api/**'
  const state: ApiState = {
    calls: [],
    unhandled: [],
    pending: new Set(),
    failures: [],
  }
  const handler = routeHandler(table, state)
  await page.route(pattern, handler)
  const settle = async (): Promise<void> => {
    await drain(state)
    const first = state.failures[0]
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
    dispose: async () => {
      await page.unroute(pattern, handler)
      await drain(state)
    },
  }
}

type ApiState = {
  readonly calls: ApiCall[]
  readonly unhandled: string[]
  readonly pending: Set<Promise<void>>
  readonly failures: unknown[]
}

function routeHandler(
  table: Readonly<Record<string, ApiHandler>>,
  state: ApiState,
): (route: Route) => Promise<void> {
  return async (route) => {
    const call = await readCall(route)
    state.calls.push(call)
    const key = apiKey(call.method, call.path)
    const answer = table[key]
    const running = (async () => {
      if (answer === undefined) {
        state.unhandled.push(key)
        await respond(route, failure(500, 'UNHANDLED_FIXTURE_REQUEST'))
        return
      }
      try {
        await respond(route, await answer(call))
      }
      catch (error: unknown) {
        state.failures.push(error)
        await respond(route, failure(500, 'FIXTURE_FAILED')).catch(() => {})
      }
    })()
    state.pending.add(running)
    await running.finally(() => state.pending.delete(running))
  }
}

async function readCall(route: Route): Promise<ApiCall> {
  const request = route.request()
  const url = new URL(request.url())
  return {
    method: request.method(),
    path: url.pathname,
    query: url.searchParams,
    json: parseBody(request.postData()),
    headers: await request.allHeaders(),
  }
}

async function respond(route: Route, reply: ApiReply): Promise<void> {
  if (reply.abort !== undefined) {
    await route.abort(reply.abort)
    return
  }
  await route.fulfill({
    status: reply.status ?? 200,
    contentType: 'application/json',
    body: JSON.stringify(reply.body ?? null),
  })
}

/** A held handler can start further traffic once it answers; drain to empty. */
async function drain(state: ApiState): Promise<void> {
  while (state.pending.size > 0) {
    await Promise.allSettled([
      ...state.pending,
    ])
  }
}

function parseBody(text: string | null): unknown {
  if (text === null || text === '') {
    return undefined
  }
  try {
    return JSON.parse(text)
  }
  catch {
    return text
  }
}

export type Held = {
  readonly promise: Promise<void>
  /** Idempotent, so a `finally` can call it after the body already released. */
  readonly open: () => void
}

/** A hold a case releases explicitly; `finally` opens it so no route stays pending. */
export function defer(): Held {
  let open: () => void = () => {}
  const promise = new Promise<void>((resolve) => {
    open = resolve
  })
  return { promise, open: () => open() }
}

export type SurfaceErrors = {
  readonly messages: string[]
  expectNone: () => void
}

/**
 * Records every uncaught page error and console error. Use it where the case
 * expects only successful responses: the browsers report each refused HTTP
 * response as a console error, so failure-path cases would record the failure
 * they are asserting on.
 */
export function watchErrors(page: Page): SurfaceErrors {
  const messages: string[] = []
  page.on('pageerror', error => messages.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      messages.push(`console: ${message.text()}`)
    }
  })
  return {
    messages,
    expectNone: () => {
      if (messages.length > 0) {
        throw new Error(`The surface reported browser errors: ${messages.join(' | ')}`)
      }
    },
  }
}
