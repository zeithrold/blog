import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Lease } from './fixture-pool'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { FixturePool } from './fixture-pool'
import { scenario } from './scenario'

// A request can keep its response unread on purpose (`x-fixture-hold-ms`) so the gateway tests can
// aim a reset, a dying Worker or a disappearing client at the window where the response body is
// still open. The header is stripped in `gatewayHeaders`, so the Worker never sees it.
const HOLD = 'x-fixture-hold-ms'
// This disposable Access gateway is only a test entry point and is absent from the Worker build.
function gatewayHeaders(incoming: IncomingMessage, token: string) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value !== undefined) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value)
    }
  }
  headers.delete('cf-access-jwt-assertion')
  headers.delete(HOLD)
  if ((headers.get('cookie') ?? '').split('; ').includes('fixture=browser-test')) {
    headers.set('cf-access-jwt-assertion', token)
  }
  return headers
}
const SIGNALS = ['SIGINT', 'SIGTERM'] as const
type GatewayOptions = { port: number, prewarm: boolean }

function route(
  fixtures: FixturePool,
  options: GatewayOptions,
  incoming: IncomingMessage,
  outgoing: ServerResponse,
): void {
  handle(fixtures, options, incoming, outgoing).catch((error: unknown) => {
    // Everything `handle` can answer, it answers with `fail`; a request that still ends up here has
    // no reply left to give, and a destroyed connection is the only signal it can send.
    console.error(error)
    outgoing.destroy()
  })
}

async function handle(
  fixtures: FixturePool,
  options: GatewayOptions,
  incoming: IncomingMessage,
  outgoing: ServerResponse,
): Promise<void> {
  if (incoming.url === '/__fixture/scenario') {
    await serve(
      fixtures,
      outgoing,
      async lease => await scenario(lease.context, incoming, outgoing),
      'Local scenario failed',
    )
    return
  }
  const request = new URL(incoming.url ?? '/', `http://127.0.0.1:${options.port}`)
  if (request.pathname === '/__fixture/health') {
    outgoing.writeHead(200, { 'content-type': 'application/json' })
    outgoing.end(JSON.stringify({
      fixture: 'browser-server',
      pid: process.pid,
      port: options.port,
      // Requests past `rent()` whose response has arrived and whose body is still unread. Tests wait
      // for this instead of sleeping, so their scenarios collide with the Worker state they mean.
      reading: fixtures.reading(),
      // The active case, so a test can tell that a swap has already happened.
      generation: fixtures.generation(),
    }))
    return
  }
  if (request.pathname === '/__fixture/reset') {
    if (incoming.method !== 'POST' || incoming.headers.host !== `127.0.0.1:${options.port}`
      || incoming.headers['sec-fetch-site'] === 'cross-site') {
      outgoing.writeHead(403)
      outgoing.end()
      return
    }
    // CPU-throttled measurement runs must not share the machine with a background build. A reset
    // serves no Worker of its own, so it holds no lease: the swap retires the previous case's
    // Worker once the requests already reading from it have finished.
    const prewarm = options.prewarm && request.searchParams.get('project') !== 'performance'
    try {
      await fixtures.reset(prewarm)
      outgoing.writeHead(204)
      outgoing.end()
    }
    catch (error) {
      fail(outgoing, error, 'Local fixture reset failed')
    }
    return
  }
  await serve(
    fixtures,
    outgoing,
    async (lease, signal) => await gateway(lease, incoming, outgoing, signal),
    'Local fixture failed',
  )
}

// Runs one request against the active Worker under a lease, so the Worker it dispatches to cannot be
// disposed while the response is still being delivered. The signal fires when the client leaves.
async function serve(
  fixtures: FixturePool,
  outgoing: ServerResponse,
  run: (lease: Lease, signal: AbortSignal) => Promise<void>,
  message: string,
): Promise<void> {
  const gone = new AbortController()
  const abandon = (): void => {
    if (!outgoing.writableFinished) {
      gone.abort()
    }
  }
  outgoing.once('close', abandon)
  let lease: Lease | undefined
  try {
    lease = fixtures.rent()
    await run(lease, gone.signal)
  }
  catch (error: unknown) {
    // The client left, so there is nobody to answer and nothing to report.
    if (!gone.signal.aborted) {
      fail(outgoing, error, message)
    }
  }
  finally {
    outgoing.off('close', abandon)
    lease?.release()
  }
}

// Answers a failed request exactly once. Once the head is out, or the client has gone, a second
// status line throws inside this handler and takes the gateway down with it, so the only honest
// signal left is a destroyed connection.
function fail(outgoing: ServerResponse, error: unknown, message: string): void {
  console.error(error)
  if (outgoing.headersSent || outgoing.writableEnded || outgoing.destroyed) {
    outgoing.destroy()
    return
  }
  try {
    outgoing.writeHead(500)
    outgoing.end(message)
  }
  catch {
    outgoing.destroy()
  }
}

async function main(): Promise<void> {
  const port = Number(process.env.BLOG_TEST_PORT ?? 8801)
  const options = {
    port,
    prewarm: process.env.BLOG_FIXTURE_PREWARM !== '0',
  }
  const fixtures = new FixturePool(
    `http://127.0.0.1:${port}`,
    process.env.BLOG_FIXTURE_FAULT,
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
    // A browser that navigates away mid-response is routine here: the socket error releases the
    // request through its lease, and must never surface as an uncaught event on either side.
    incoming.on('error', () => undefined)
    outgoing.on('error', () => undefined)
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

async function gateway(
  lease: Lease,
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  signal: AbortSignal,
) {
  const context = lease.context
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
  // The signal aborts the Worker request when the client leaves, so a departed client releases its
  // Worker instead of being read out to the end.
  const response = await context.fixture.dispatchFetch(
    new URL(incoming.url ?? '/', context.origin),
    {
      method: incoming.method,
      headers: Object.fromEntries(gatewayHeaders(incoming, context.token)),
      body: parts.length > 0 ? Buffer.concat(parts) : undefined,
      redirect: 'manual',
      signal,
    },
  )
  // From here the runtime's response exists and its body has not been read: the window a Worker must
  // survive, and the state the gateway tests wait for.
  lease.reading()
  await holdFor(incoming, signal)
  // The body is read before the head is sent, so a Worker that dies mid-response is reported as a
  // failed request instead of a half-written response.
  const body = Buffer.from(await response.arrayBuffer())
  if (signal.aborted) {
    return
  }
  outgoing.writeHead(response.status, Object.fromEntries(response.headers))
  outgoing.end(body)
}

// Keeps a response unread for `x-fixture-hold-ms`; the wait ends early when the client goes away.
async function holdFor(incoming: IncomingMessage, signal: AbortSignal): Promise<void> {
  const hold = Number(incoming.headers[HOLD] ?? 0)
  if (hold > 0) {
    await delay(hold, undefined, { signal })
  }
}
main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
