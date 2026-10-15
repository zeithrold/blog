import type { HistoryEntry, HistoryGuard } from '../src/shared/admin/history-navigation'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HistoryNavigation, historyPosition } from '../src/shared/admin/history-navigation'
import { deepEqual, equal } from './assertions'

function entry(index: number, path = `/page/${index}`, session = 'current'): HistoryEntry {
  return { href: `https://example.test${path}`, position: { session, index } }
}

function setup(cancelGuard?: () => void) {
  let current = entry(4)
  const steps: number[] = []
  const requests: { href: string, commit: () => void }[] = []
  let guard: HistoryGuard | null = (href, commit) => requests.push({ href, commit })
  const navigation = new HistoryNavigation({
    read: () => current,
    go: delta => steps.push(delta),
    guard: () => guard,
    cancelGuard,
  })
  return {
    navigation,
    requests,
    steps,
    move: (value: HistoryEntry) => { current = value },
    clean: () => { guard = null },
  }
}

test('history guards the protected editor and commits the original traversal only once', () => {
  for (const index of [2, 6]) {
    const destination = entry(index)
    const fixture = setup()
    fixture.move(destination)
    equal(fixture.navigation.pop(), true)
    deepEqual(fixture.steps, [
      4 - index,
    ])
    equal(fixture.requests.length, 1)
    fixture.move(entry(4))
    equal(fixture.navigation.pop(), true)
    equal(fixture.requests[0]?.href, destination.href)
    fixture.requests[0]?.commit()
    fixture.requests[0]?.commit()
    deepEqual(fixture.steps, [
      4 - index,
      index - 4,
    ])
    fixture.move(destination)
    equal(fixture.navigation.pop(), false)
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('cancellation drains pending repairs without reopening the guard or accepting stale approvals', () => {
  const fixture = setup()
  fixture.move(entry(3))
  fixture.navigation.pop(false)
  fixture.move(entry(4))
  fixture.navigation.pop(true)
  fixture.move(entry(6))
  fixture.navigation.pop(false)
  fixture.navigation.cancel()
  fixture.move(entry(5))
  fixture.navigation.pop(true)
  fixture.move(entry(4))
  fixture.navigation.pop(true)
  fixture.requests[0]?.commit()
  equal(fixture.requests.length, 2)
  equal(fixture.steps.at(-1), -1)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('an earlier approved arrival cannot replace a newer user destination', () => {
  const fixture = setup()
  fixture.move(entry(3))
  fixture.navigation.pop(false)
  fixture.move(entry(4))
  fixture.navigation.pop(true)
  fixture.requests[0]?.commit()
  fixture.move(entry(2))
  fixture.navigation.pop(false)
  fixture.move(entry(3))
  fixture.navigation.pop(true)
  fixture.move(entry(4))
  fixture.navigation.pop(true)
  equal(fixture.requests[1]?.href, entry(2).href)
  fixture.requests[1]?.commit()
  fixture.move(entry(2))
  equal(fixture.navigation.pop(true), false)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('approval waits for a stale internal traversal to finish returning to the source', () => {
  const fixture = setup()
  fixture.move(entry(3))
  fixture.navigation.pop(false)
  fixture.move(entry(4))
  fixture.navigation.pop(true)
  fixture.move(entry(6))
  fixture.navigation.pop(true)
  fixture.requests[0]?.commit()
  equal(fixture.steps.at(-1), -2)
  fixture.move(entry(4))
  fixture.navigation.pop(true)
  equal(fixture.steps.at(-1), -1)
  fixture.move(entry(3))
  equal(fixture.navigation.pop(true), false)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a write replacing the source invalidates pending repairs and keeps later navigation usable', () => {
  const fixture = setup()
  fixture.move(entry(3))
  fixture.navigation.pop(false)
  const branched = { ...entry(4, '/new-branch'), key: 'replacement' }
  fixture.move(branched)
  fixture.navigation.written()
  fixture.requests[0]?.commit()
  equal(fixture.steps.length, 1)
  fixture.move(entry(3))
  fixture.navigation.pop(false)
  equal(fixture.requests[1]?.href, entry(3).href)
  fixture.move(branched)
  fixture.navigation.pop(true)
  fixture.requests[1]?.commit()
  fixture.move(entry(3))
  equal(fixture.navigation.pop(true), false)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('returning to the source cancels the editor departure while internal approval does not', () => {
  let cancellations = 0
  const fixture = setup(() => cancellations++)
  fixture.move(entry(3))
  fixture.navigation.pop(false)
  fixture.move(entry(4))
  fixture.navigation.pop(false)
  equal(cancellations, 1)
  fixture.requests[0]?.commit()
  equal(fixture.steps.length, 1)
  fixture.move(entry(3))
  fixture.navigation.pop(false)
  fixture.move(entry(4))
  fixture.navigation.pop(true)
  fixture.requests[1]?.commit()
  fixture.move(entry(3))
  equal(fixture.navigation.pop(true), false)
  equal(cancellations, 1)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a newer history request or intervening route makes an old continuation inert', () => {
  const fixture = setup()
  fixture.move(entry(3))
  fixture.navigation.pop()
  fixture.move(entry(4))
  fixture.navigation.pop()
  const first = fixture.requests[0]
  fixture.move(entry(2))
  fixture.navigation.pop()
  fixture.move(entry(4))
  fixture.navigation.pop()
  first?.commit()
  deepEqual(fixture.steps, [1, 2])
  fixture.move(entry(5))
  fixture.navigation.sync()
  fixture.requests[1]?.commit()
  deepEqual(fixture.steps, [1, 2])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('hash traversal and clean or untracked entries are left to the browser', () => {
  const hash = setup()
  hash.move(entry(5, '/page/4#heading'))
  assert.equal(hash.navigation.pop(), false)
  assert.deepEqual(hash.requests, [])
  const clean = setup()
  clean.clean()
  clean.move(entry(3))
  assert.equal(clean.navigation.pop(), false)
  for (const destination of [
    entry(3, '/other', 'previous-document'),
    { href: 'https://example.test/other', position: null },
  ]) {
    const fixture = setup()
    fixture.move(destination)
    assert.equal(fixture.navigation.pop(), false)
    assert.deepEqual(fixture.steps, [])
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('same URLs and query changes in different entries still receive the guard', () => {
  for (const destination of [
    entry(3, '/page/4'),
    entry(3, '/page/4?view=other'),
  ]) {
    const fixture = setup()
    fixture.move(destination)
    assert.equal(fixture.navigation.pop(), true)
  }
  assert.equal(historyPosition(null), null)
  assert.equal(historyPosition({ __blogHistory: { session: 'current', index: 1.5 } }), null)
  deepEqual(historyPosition({ __blogHistory: { session: 'current', index: 3 } }), { session: 'current', index: 3 })
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('the latest destination observed while restoring replaces the first request', () => {
  for (const latest of [2, 6]) {
    const fixture = setup()
    fixture.move(entry(3))
    fixture.navigation.pop()
    fixture.move(entry(latest))
    fixture.navigation.pop()
    fixture.move(entry(4))
    fixture.navigation.pop()
    equal(fixture.requests.length, 2)
    equal(fixture.requests.at(-1)?.href, entry(latest).href)
    fixture.requests.at(-1)?.commit()
    equal(fixture.steps.at(-1), latest - 4)
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
