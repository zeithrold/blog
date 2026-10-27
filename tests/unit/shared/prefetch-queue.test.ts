import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  promoteAppPrefetchFetch,
  releaseAppPrefetchFetchSlot,
  scheduleAppPrefetchFetch,
} from 'vinext/shims/internal/app-prefetch-fetch-queue'
import { snapshotRscResponse } from 'vinext/shims/navigation'

function batch(snapshotFirst = false) {
  const upstream = Array.from({ length: 6 }, () => Promise.withResolvers<Response>())
  const started: number[] = []
  const requests: Promise<Response>[] = []
  for (const [index, pending] of upstream.entries()) {
    requests.push(scheduleAppPrefetchFetch(async () => {
      started.push(index)
      return await pending.promise
    }, 'low'))
  }
  // Always attach rejection handlers immediately, as the real prefetch cache does.
  const results = requests.map(async (request, index) => await request.then(async (response) => {
    if (snapshotFirst && index === 0) {
      return await snapshotRscResponse(response)
    }
    releaseAppPrefetchFetchSlot(response)
    return response
  }).catch((error: unknown) => error))
  return {
    upstream,
    started,
    requests,
    results,
    dispose: async () => {
      upstream.forEach((pending) => {
        pending.resolve(new Response('settled'))
      })
      await Promise.all(results)
    },
  }
}

test('a transport failure cancels queued speculative work without dispatching it from a dying document', async () => {
  const pending = batch()
  const failure = new TypeError('Transport closed')
  try {
    await Promise.resolve()
    assert.ok(pending.started.join(',') === '0,1,2,3')
    pending.upstream[0]?.reject(failure)
    assert.equal(await pending.results[0], failure)
    assert.ok(pending.started.join(',') === '0,1,2,3')
    assert.equal(await pending.results[4], failure)
    assert.equal(await pending.results[5], failure)
    const next = await scheduleAppPrefetchFetch(async () => await Promise.resolve(new Response('new batch')), 'low')
    assert.equal(await next.text(), 'new batch')
    releaseAppPrefetchFetchSlot(next)
  }
  finally {
    await pending.dispose()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a response body failure cancels queued work before snapshot cleanup releases its slot', async () => {
  const pending = batch(true)
  const failure = new TypeError('Body transport closed')
  try {
    await Promise.resolve()
    pending.upstream[0]?.resolve(new Response(new ReadableStream({
      start(controller) {
        controller.error(failure)
      },
    })))
    assert.equal(await pending.results[0], failure)
    assert.ok(pending.started.join(',') === '0,1,2,3')
    assert.equal(await pending.results[4], failure)
    assert.equal(await pending.results[5], failure)
  }
  finally {
    await pending.dispose()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a speculative failure leaves promoted navigation and high-priority traffic independent', async () => {
  const pending = batch()
  const failure = new TypeError('Speculative transport closed')
  try {
    await Promise.resolve()
    promoteAppPrefetchFetch(pending.requests[4])
    const navigation = await scheduleAppPrefetchFetch(
      async () => await Promise.resolve(new Response('navigation')),
      'high',
    )
    assert.equal(await navigation.text(), 'navigation')
    releaseAppPrefetchFetchSlot(navigation)
    pending.upstream[0]?.reject(failure)
    assert.equal(await pending.results[0], failure)
    assert.equal(await pending.results[5], failure)
    pending.upstream[4]?.resolve(new Response('promoted navigation'))
    const promoted = await pending.results[4]
    assert.ok(promoted instanceof Response)
    assert.equal(await promoted.text(), 'promoted navigation')
    const realFailure = new Error('Navigation failed')
    await assert.rejects(scheduleAppPrefetchFetch(async () => {
      await Promise.resolve()
      throw realFailure
    }, 'high'), error => error === realFailure)
  }
  finally {
    await pending.dispose()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a synchronous fetcher failure also cancels the queued batch and retains its cause', async () => {
  const failure = new Error('Fetcher failed before returning a promise')
  const laterStarted: number[] = []
  const first = scheduleAppPrefetchFetch(() => {
    throw failure
  }, 'low').catch((error: unknown) => error)
  const later = scheduleAppPrefetchFetch(async () => {
    laterStarted.push(1)
    return await Promise.resolve(new Response('must not dispatch'))
  }, 'low').then((response) => {
    releaseAppPrefetchFetchSlot(response)
    return response
  }, (error: unknown) => error)
  assert.equal(await first, failure)
  assert.equal(await later, failure)
  assert.equal(laterStarted.length, 0)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
