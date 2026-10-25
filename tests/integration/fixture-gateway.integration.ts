import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import process from 'node:process'
import { after, test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { operationsSchema } from '@/contracts/operations'
import { equal } from '~/tests/support/unit/assertions'
import { clean, nextCase, probe, seed } from '~/tests/support/worker/fixture-case'
import {
  call,
  children,
  cleanupGateways,
  health,
  postReset,
  reset,
  start,
  status,
  stop,
  waitForChildren,
  withGateway,
} from '~/tests/support/worker/fixture-gateway'
import { json } from '~/tests/support/worker/responses'

// The browser runner keeps one built Worker per case and rebuilds it at every case boundary.
// These tests drive that gateway exactly as the runner does: seed a case, reset, then prove the
// next case starts with clean D1, R2, live, search, history, mutation, schedule, quota and
// authentication state. They also cover both reset modes, build failures after allocation,
// failure reporting when switching to a measurement run, shutdown behaviour, and responses a case
// boundary interrupts.
const port = Number(process.env.BLOG_FIXTURE_PORT ?? 8841)
// The gateway's own seam: a request that keeps its response unread so a Worker cannot be retired
// out from under it. Retirement waits for the response instead of terminating its connection.
const hold = 'x-fixture-hold-ms'
function report(message: string): void {
  process.stdout.write(`${message}\n`)
}

async function liveness(origin: string): Promise<number> {
  return await status(await fetch(`${origin}/__fixture/health`))
}

async function isolation(origin: string, project: string): Promise<{ cold: number, warm: number }> {
  const seeded = await seed(origin)
  const cold = await reset(origin, project)
  await nextCase(origin, seeded)
  // Stands in for a case body: the next Worker has time to build while the case runs.
  await delay(2500)
  const warm = await reset(origin, project)
  await clean(origin, seeded)
  return { cold, warm }
}

after(async () => {
  await cleanupGateways()
})

test('a synchronous reset starts the next case clean', async () => {
  const timings = await withGateway(
    { port, env: { BLOG_FIXTURE_PREWARM: '0' } },
    async gateway => await isolation(gateway.origin, 'chromium'),
  )
  report(`synchronous reset: ${timings.cold.toFixed(0)}ms, ${timings.warm.toFixed(0)}ms`)
}).catch((error: unknown) => {
  throw error
})

test('a prewarmed reset starts the next case clean and keeps one spare', async () => {
  await withGateway({ port }, async (gateway) => {
    equal(await status(await fetch(`${gateway.origin}/__fixture/reset`)), 403, 'a reset must be a POST')
    const pid = gateway.child.pid ?? 0
    const timings = await isolation(gateway.origin, 'chromium')
    await waitForChildren(pid, 2)
    report(
      `prewarmed reset: ${timings.cold.toFixed(0)}ms without a spare, ${timings.warm.toFixed(0)}ms with one`,
    )
    // CPU-throttled measurement runs must never share the machine with a background build.
    const performanceCase = await reset(gateway.origin, 'performance')
    await waitForChildren(pid, 1)
    report(`performance reset: ${performanceCase.toFixed(0)}ms, no spare kept`)
  })
}).catch((error: unknown) => {
  throw error
})

test('a reset waits for the response its Worker is still delivering', async () => {
  await withGateway({ port }, async (gateway) => {
    const pid = gateway.child.pid ?? 0
    // Warm the spare so the reset below swaps immediately instead of building first.
    await reset(gateway.origin, 'chromium')
    await waitForChildren(pid, 2)
    await probe(gateway.origin)
    equal((await health(gateway.origin)).documents, 1, 'the running case owns one document')
    // The previous case's Worker answers this request and keeps its body open while the reset swaps
    // in the spare. Disposing that Worker here is what reported `UNDICI terminated`, then threw
    // `ERR_HTTP_HEADERS_SENT` from the error handler and killed the gateway process.
    const held = call(gateway.origin, '/api/admin/operations', { headers: { [hold]: '3000' } })
    await delay(300)
    const elapsed = await reset(gateway.origin, 'chromium')
    equal((await json(await held, 200, operationsSchema)).documents, 1, 'the open response still completes')
    assert.ok(elapsed >= 2500, `a reset waited for the open response, took ${elapsed.toFixed(0)}ms`)
    // The retired Worker is gone while the spare it was swapped for is now active.
    await waitForChildren(pid, 2)
    equal((await health(gateway.origin)).documents, 0, 'the next case serves from the replacement')
  })
}).catch((error: unknown) => {
  throw error
})

test('a Worker that dies mid-response fails one request, not the gateway', async () => {
  await withGateway({ port, env: { BLOG_FIXTURE_PREWARM: '0' } }, async (gateway) => {
    const pid = gateway.child.pid ?? 0
    await waitForChildren(pid, 1)
    const worker = (await children(pid))[0]
    assert.ok(worker !== undefined)
    const held = call(gateway.origin, '/api/admin/operations', { headers: { [hold]: '3000' } })
    await delay(300)
    // The response is open and unread on the Worker when its process disappears.
    process.kill(worker, 'SIGKILL')
    const failed = await held
    equal(failed.status, 500)
    equal(await failed.text(), 'Local fixture failed')
    // The shard keeps its gateway, and the next case still gets a running Worker.
    equal(await liveness(gateway.origin), 200)
    await reset(gateway.origin, 'chromium')
    equal(await status(await call(gateway.origin, '/api/admin/documents')), 200)
  })
}).catch((error: unknown) => {
  throw error
})

test('a client that disconnects mid-response releases its Worker', async () => {
  await withGateway({ port }, async (gateway) => {
    const pid = gateway.child.pid ?? 0
    await reset(gateway.origin, 'chromium')
    await waitForChildren(pid, 2)
    const abort = new AbortController()
    const abandoned = call(gateway.origin, '/api/admin/operations', {
      headers: { [hold]: '1500' },
      signal: abort.signal,
    })
    await delay(300)
    abort.abort()
    await assert.rejects(abandoned)
    // The abandoned response still finishes on the Worker; its lease must survive the client.
    await delay(1500)
    equal(await liveness(gateway.origin), 200)
    const elapsed = await reset(gateway.origin, 'chromium')
    assert.ok(elapsed < 9000, `a departed client held retirement for ${elapsed.toFixed(0)}ms`)
    await waitForChildren(pid, 2)
    equal(await status(await call(gateway.origin, '/api/admin/documents')), 200)
  })
}).catch((error: unknown) => {
  throw error
})

test('a Worker that fails after allocation is disposed instead of leaked', async () => {
  await withGateway(
    { port, env: { BLOG_FIXTURE_FAULT: 'runtime:2:migrate' } },
    async (gateway) => {
      const pid = gateway.child.pid ?? 0
      const failed = await postReset(gateway.origin, 'chromium')
      equal(failed.status, 500)
      equal(failed.body, 'Local fixture reset failed')
      equal(gateway.output().includes('Injected fixture runtime failure'), true)
      // The half-built Worker was disposed: only the running case's Worker is left.
      const probeId = await probe(gateway.origin)
      await waitForChildren(pid, 1)
      await reset(gateway.origin, 'chromium')
      equal(await status(await call(gateway.origin, `/api/admin/documents/${probeId}`)), 404)
    },
  )
}).catch((error: unknown) => {
  throw error
})

test('a failed spare fails the reset that switches to a measurement run', async () => {
  await withGateway({ port, env: { BLOG_FIXTURE_FAULT: 'build:3' } }, async (gateway) => {
    // The first reset builds its own Worker and leaves a spare whose build is injected to fail.
    await reset(gateway.origin, 'chromium')
    const probeId = await probe(gateway.origin)
    const failed = await postReset(gateway.origin, 'performance')
    equal(failed.status, 500)
    equal(failed.body, 'Local fixture reset failed')
    equal(gateway.output().includes('Injected fixture build failure'), true)
    // A failed reset never swaps a broken Worker in: the running case keeps serving.
    equal(await status(await call(gateway.origin, `/api/admin/documents/${probeId}`)), 200)
    await reset(gateway.origin, 'performance')
    equal(await status(await call(gateway.origin, `/api/admin/documents/${probeId}`)), 404)
  })
}).catch((error: unknown) => {
  throw error
})

test('a spare that fails while shutting down is reported, never dropped', async () => {
  const gateway = await start({ port, env: { BLOG_FIXTURE_FAULT: 'build:3' } })
  await reset(gateway.origin, 'chromium')
  // No further reset observes the spare, so shutdown itself must report the failure.
  equal(await stop(gateway), 1)
  equal(gateway.output().includes('Injected fixture build failure'), true)
}).catch((error: unknown) => {
  throw error
})

test('a dispose failure during shutdown is reported, never exit 0', async () => {
  const gateway = await start({ port, env: { BLOG_FIXTURE_FAULT: 'dispose' } })
  equal(await stop(gateway), 1)
  equal(gateway.output().includes('Injected fixture dispose failure'), true)
}).catch((error: unknown) => {
  throw error
})

test('a second shutdown signal cannot finish the first one early', async () => {
  const gateway = await start({ port, env: { BLOG_FIXTURE_FAULT: 'build:3' } })
  await reset(gateway.origin, 'chromium')
  // The spare has failed; two signals must still surface that failure instead of exiting 0.
  gateway.child.kill('SIGTERM')
  gateway.child.kill('SIGINT')
  equal(await stop(gateway), 1)
  equal(gateway.output().includes('Injected fixture build failure'), true)
}).catch((error: unknown) => {
  throw error
})

test('repeated shutdown signals still dispose the warm spare', async () => {
  const gateway = await start({ port })
  await reset(gateway.origin, 'chromium')
  const pid = gateway.child.pid ?? 0
  await waitForChildren(pid, 2)
  gateway.child.kill('SIGTERM')
  gateway.child.kill('SIGTERM')
  // `stop` records both Workerd children before signalling and requires both to be gone.
  equal(await stop(gateway), 0)
}).catch((error: unknown) => {
  throw error
})

test('start refuses a port that belongs to another server and cleans up', async () => {
  const squatter = createServer((_incoming, outgoing) => {
    outgoing.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}')
  })
  await new Promise<void>((resolve) => {
    squatter.listen(port, '127.0.0.1', () => resolve())
  })
  try {
    await assert.rejects(
      start({ port }),
      /another server answered|fixture gateway exited early/,
    )
  }
  finally {
    await new Promise<void>((resolve) => {
      squatter.close(() => resolve())
    })
  }
}).catch((error: unknown) => {
  throw error
})
