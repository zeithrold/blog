import type { DeparturePermit, DepartureSource } from '@/features/editor/workspace/editor-departure'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { approvedUnload, EditorDeparture } from '@/features/editor/workspace/editor-departure'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

function deferred<T>(): { promise: Promise<T>, resolve: (value: T) => void } {
  let resolve = (_value: T): void => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function source(patch: Partial<DepartureSource> = {}): { source: DepartureSource, destinations: string[] } {
  const destinations: string[] = []
  return {
    destinations,
    source: {
      wait: async () => await Promise.resolve(undefined),
      save: async () => await Promise.resolve(true),
      recover: async () => await Promise.resolve(true),
      failure: () => 'CONNECTION_FAILED',
      navigate: href => destinations.push(href),
      ...patch,
    },
  }
}

async function until(predicate: () => boolean): Promise<void> {
  for (let tick = 0; tick < 30 && !predicate(); tick++) {
    await Promise.resolve(undefined)
  }
  equal(predicate(), true)
}

test('navigation waits for readiness and the final save before leaving', async () => {
  const ready = deferred<undefined>()
  const saved = deferred<boolean>()
  let saves = 0
  const fixture = source({ wait: async () => await ready.promise, save: async () => {
    saves++
    return await saved.promise
  } })
  const permit: DeparturePermit = { approved: false, event: null }
  const controller = new EditorDeparture(fixture.source, permit)
  controller.request('/admin/tags')
  equal(controller.snapshot().phase, 'saving')
  equal(saves, 0)
  ready.resolve(undefined)
  await until(() => saves === 1)
  deepEqual(fixture.destinations, [])
  saved.resolve(true)
  await until(() => fixture.destinations.length === 1)
  deepEqual(fixture.destinations, ['/admin/tags'])
  // A navigation that returns without unloading must not leave approval armed.
  equal(permit.approved, false)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a refused save keeps the author until they retry or explicitly leave', async () => {
  for (const retry of [true, false]) {
    let attempts = 0
    const fixture = source({ save: async () => await Promise.resolve(++attempts > 1) })
    const permit: DeparturePermit = { approved: false, event: null }
    const controller = new EditorDeparture(fixture.source, permit)
    controller.request('/admin/tags')
    await until(() => controller.snapshot().phase === 'error')
    deepEqual(fixture.destinations, [])
    equal(permit.approved, false)
    if (retry) {
      controller.retry()
      await until(() => fixture.destinations.length === 1)
    }
    else {
      controller.leave()
    }
    // Either answer attempts to leave once, with no lingering approval.
    deepEqual(fixture.destinations, ['/admin/tags'])
    equal(permit.approved, false)
    controller.leave()
    equal(fixture.destinations.length, 1)
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('staying in the editor during a save suppresses late navigation', async () => {
  const saved = deferred<boolean>()
  let saves = 0
  const fixture = source({ save: async () => {
    saves++
    return await saved.promise
  } })
  const permit: DeparturePermit = { approved: false, event: null }
  const controller = new EditorDeparture(fixture.source, permit)
  controller.request('/admin/media')
  await until(() => saves === 1)
  controller.cancel()
  equal(permit.approved, false)
  saved.resolve(true)
  await until(() => controller.snapshot().phase === 'idle')
  await Promise.resolve(undefined)
  deepEqual(fixture.destinations, [])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('save failures retain their reason, check recovery and permit retry or explicit leave', async () => {
  for (const recover of [true, false]) {
    let saves = 0
    const fixture = source({
      save: async () => await Promise.resolve(++saves > 1),
      recover: async () => await Promise.resolve(recover),
    })
    const permit: DeparturePermit = { approved: false, event: null }
    const controller = new EditorDeparture(fixture.source, permit)
    controller.request('/admin/tags')
    await until(() => controller.snapshot().phase === 'error')
    deepEqual(controller.snapshot(), { phase: 'error', error: 'CONNECTION_FAILED', recovered: recover })
    deepEqual(fixture.destinations, [])
    equal(permit.approved, false)
    if (recover) {
      controller.retry()
      await until(() => fixture.destinations.length === 1)
      equal(saves, 2)
    }
    else {
      controller.leave()
      controller.leave()
      equal(saves, 1)
    }
    deepEqual(fixture.destinations, ['/admin/tags'])
    equal(permit.approved, false)
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a later navigation request wins while an earlier upload wait is pending', async () => {
  const waits = [
    deferred<undefined>(),
    deferred<undefined>(),
  ]
  let calls = 0
  const fixture = source({ wait: async () => await waits[calls++]?.promise })
  const controller = new EditorDeparture(fixture.source, { approved: false, event: null })
  controller.request('/first')
  controller.request('/second')
  waits[0]?.resolve(undefined)
  await Promise.resolve(undefined)
  deepEqual(fixture.destinations, [])
  waits[1]?.resolve(undefined)
  await until(() => fixture.destinations.length === 1)
  deepEqual(fixture.destinations, ['/second'])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('cancelling or disposing while saving a recovery copy cannot reopen the dialog or navigate', async () => {
  for (const dispose of [true, false]) {
    const recovery = deferred<boolean>()
    let recovering = false
    const fixture = source({ save: async () => await Promise.resolve(false), recover: async () => {
      recovering = true
      return await recovery.promise
    } })
    const permit: DeparturePermit = { approved: false, event: null }
    const controller = new EditorDeparture(fixture.source, permit)
    controller.request('/admin')
    await until(() => recovering)
    if (dispose) {
      controller.dispose()
    }
    else {
      controller.cancel()
    }
    recovery.resolve(true)
    await Promise.resolve(undefined)
    await Promise.resolve(undefined)
    deepEqual(fixture.destinations, [])
    equal(permit.approved, false)
    assert.notEqual(controller.snapshot().phase, 'error')
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('approval covers both guards for one unload, even when that departure was clean', () => {
  const permit: DeparturePermit = { approved: true, event: null }
  const first = new Event('beforeunload', { cancelable: true })
  equal(approvedUnload(permit, first), true)
  equal(permit.approved, false)
  equal(approvedUnload(permit, first), true)
  const later = new Event('beforeunload', { cancelable: true })
  equal(approvedUnload(permit, later), false)
  equal(approvedUnload(permit, later), false)
  equal(approvedUnload(null, later), false)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('approved navigation consumes its event and leaves later browser departures protected', async () => {
  const permit: DeparturePermit = { approved: false, event: null }
  const first = new Event('beforeunload')
  const fixture = source({
    navigate: () => {
      equal(approvedUnload(permit, first), true)
      equal(approvedUnload(permit, first), true)
    },
  })
  const controller = new EditorDeparture(fixture.source, permit)
  controller.request('/admin')
  await until(() => permit.event === first)
  equal(permit.approved, false)
  equal(approvedUnload(permit, new Event('beforeunload')), false)
  controller.cancel()
  equal(permit.event, null)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a synchronous navigation failure clears departure approval', async () => {
  const permit: DeparturePermit = { approved: false, event: null }
  let attempted = false
  const fixture = source({
    save: async () => await Promise.resolve(false),
    navigate: () => {
      attempted = true
      throw new Error('navigation refused')
    },
  })
  const controller = new EditorDeparture(fixture.source, permit)
  controller.request('/admin')
  await until(() => controller.snapshot().phase === 'error')
  assert.throws(controller.leave, /navigation refused/u)
  equal(attempted, true)
  equal(permit.approved, false)
  equal(approvedUnload(permit, new Event('beforeunload')), false)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
