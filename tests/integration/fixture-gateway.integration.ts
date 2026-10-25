import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import process from 'node:process'
import { after, test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { equal } from '~/tests/support/unit/assertions'
import { clean, nextCase, probe, seed } from '~/tests/support/worker/fixture-case'
import {
  call,
  cleanupGateways,
  postReset,
  reset,
  start,
  status,
  stop,
  waitForChildren,
  withGateway,
} from '~/tests/support/worker/fixture-gateway'

// The browser runner keeps one built Worker per case and rebuilds it at every case boundary.
// These tests drive that gateway exactly as the runner does: seed a case, reset, then prove the
// next case starts with clean D1, R2, live, search, history, mutation, schedule, quota and
// authentication state. They also cover both reset modes, build failures after allocation,
// failure reporting when switching to a measurement run and shutdown behaviour.
const port = Number(process.env.BLOG_FIXTURE_PORT ?? 8841)
function report(message: string): void {
  process.stdout.write(`${message}\n`)
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
