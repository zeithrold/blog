import { expect, vi } from 'vitest'

export type ApiReply = { status?: number, body?: unknown, abort?: 'failed' }
export type ApiCall = {
  readonly method: string
  readonly path: string
  readonly query: URLSearchParams
  readonly json: unknown
  readonly headers: Record<string, string>
}
export type ApiHandler = (call: ApiCall) => ApiReply | Promise<ApiReply>
export type ApiService = {
  readonly calls: ApiCall[]
  readonly unhandled: string[]
  settle: () => Promise<void>
  expectServed: () => Promise<void>
  dispose: () => void
}

export function failure(status: number, code: string): ApiReply {
  return { status, body: { code } }
}

export function lostResponse(): ApiReply {
  return { abort: 'failed' }
}

export function defer(): { promise: Promise<void>, open: () => void } {
  let open = (): void => {}
  const promise = new Promise<void>((resolve) => {
    open = resolve
  })
  return { promise, open }
}

const services: ApiService[] = []
let active = false
const lost = new TypeError('Declared lost response')

function callFor(input: RequestInfo | URL, init?: RequestInit): ApiCall {
  if (input instanceof Request) {
    throw new TypeError('This fixture supports URL requests, not streamed Request bodies')
  }
  const url = new URL(input, 'http://localhost')
  return {
    method: (init?.method ?? 'GET').toUpperCase(),
    path: url.pathname,
    query: url.searchParams,
    json: typeof init?.body === 'string' && init.body !== '' ? JSON.parse(init.body) as unknown : undefined,
    headers: Object.fromEntries(new Headers(init?.headers)),
  }
}

async function answer(
  table: Readonly<Record<string, ApiHandler>>,
  call: ApiCall,
  unhandled: string[],
): Promise<Response> {
  const key = `${call.method} ${call.path}`
  const generic = key.replace(/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/gi, ':id')
  const handler = table[key] ?? table[generic]
  if (handler === undefined) {
    unhandled.push(key)
    throw new Error(`Unexpected request: ${key}`)
  }
  const reply = await handler(call)
  if (reply.abort !== undefined) {
    throw lost
  }
  return new Response(JSON.stringify(reply.body ?? null), {
    status: reply.status ?? 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** One explicit HTTP table per test; no server, transport scheduler or receipts. */
export function serveFetch(table: Readonly<Record<string, ApiHandler>>): ApiService {
  if (active) {
    throw new Error('Dispose the previous HTTP fixture before installing another')
  }
  active = true
  const calls: ApiCall[] = []
  const unhandled: string[] = []
  const pending = new Set<Promise<unknown>>()
  const errors: unknown[] = []
  const mock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const task = Promise.resolve().then(async () => {
      const call = callFor(input, init)
      calls.push(call)
      return await answer(table, call, unhandled)
    })
    pending.add(task)
    try {
      return await task
    }
    catch (error) {
      if (error !== lost) {
        errors.push(error)
        throw error
      }
      throw lost
    }
    finally {
      pending.delete(task)
    }
  })
  const settle = async (): Promise<void> => {
    while (pending.size > 0) {
      await Promise.allSettled(Array.from(pending))
    }
    expect(unhandled, 'Unexpected HTTP requests').toEqual([])
    expect(errors, 'HTTP fixture errors').toEqual([])
  }
  let disposed = false
  const service: ApiService = {
    calls,
    unhandled,
    settle,
    expectServed: settle,
    dispose: () => {
      if (!disposed) {
        disposed = true
        active = false
        mock.mockRestore()
      }
    },
  }
  services.push(service)
  return service
}

export async function resetFetch(): Promise<void> {
  try {
    for (const service of services) {
      await service.expectServed()
    }
  }
  finally {
    for (const service of services.splice(0)) {
      service.dispose()
    }
  }
}
