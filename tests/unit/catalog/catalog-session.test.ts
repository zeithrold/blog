import type { CatalogEntry } from '@/features/catalog/catalog-types'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { catalogSession, CatalogSession } from '@/features/catalog/catalog-session'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

function entry(name = 'Original'): CatalogEntry {
  return { id: crypto.randomUUID(), kind: 'tag', name, slug: name.toLowerCase(), retired: false, version: 0 }
}

function deferred<T>(): { promise: Promise<T>, resolve: (value: T) => void } {
  let resolve = (_value: T): void => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test('a catalog read cannot reselect an old entry or replace a new form', async () => {
  const first = entry()
  const second = entry('Second')
  const session = new CatalogSession('tag', 'test-csrf')
  const response = deferred<Response>()
  const fetch = mock.method(globalThis, 'fetch', async () => await response.promise)
  try {
    session.begin(first)
    const reading = session.refresh()
    session.begin(second)
    session.change('name', 'Local second')
    response.resolve(Response.json({ items: [
      { ...first, version: 1 },
      second,
    ] }))
    await reading
    equal(session.snapshot().edit?.id, second.id)
    equal(session.snapshot().name, 'Local second')
    session.begin(null)
    session.change('name', 'New entry')
    await session.refresh()
    equal(session.snapshot().edit, null)
    equal(session.snapshot().name, 'New entry')
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('catalog refresh merges current edits with untouched remote fields and a newer version', async () => {
  const base = entry()
  const remote = { ...base, name: 'Remote', slug: 'remote', retired: true, version: 1 }
  const session = new CatalogSession('tag', 'test-csrf')
  const response = deferred<Response>()
  const fetch = mock.method(globalThis, 'fetch', async () => await response.promise)
  try {
    session.begin(base)
    const reading = session.refresh()
    session.change('name', 'Typed while loading')
    response.resolve(Response.json({ items: [remote] }))
    await reading
    const state = session.snapshot()
    deepEqual([
      state.name,
      state.slug,
      state.retired,
      state.edit?.version,
      state.dirty,
    ], [
      'Typed while loading',
      'remote',
      true,
      1,
      true,
    ])
    session.begin(remote)
    await session.refresh()
    equal(session.snapshot().dirty, false)
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a confirmed catalog save survives a failed read and ignores an older read', async () => {
  const saved = entry('Saved')
  const stale = deferred<Response>()
  let reads = 0
  const fetch = mock.method(globalThis, 'fetch', async (_path: unknown, init: RequestInit) => {
    if (init.method === 'POST') {
      return Response.json(saved)
    }
    if (++reads === 1) {
      return await stale.promise
    }
    return Response.json({ code: 'UNAVAILABLE' }, { status: 503 })
  })
  try {
    const session = new CatalogSession('tag', 'test-csrf')
    const reading = session.refresh()
    session.change('name', saved.name)
    session.change('slug', saved.slug)
    const outcome = await session.save()
    stale.resolve(Response.json({ items: [] }))
    await reading
    deepEqual(session.snapshot().data?.items, [saved])
    equal(session.snapshot().dirty, false)
    equal(session.snapshot().busy, false)
    equal(outcome, 'created')
    assert.match(session.snapshot().loadError, /Unable to load/)
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('an in-flight catalog save keeps its target and finishes after its view unsubscribes', async () => {
  const base = entry()
  const response = deferred<Response>()
  let writes = 0
  const fetch = mock.method(globalThis, 'fetch', async (_path: unknown, init: RequestInit) => {
    if (init.method === 'PUT') {
      writes++
      return await response.promise
    }
    return Response.json({ items: [
      { ...base, name: 'Saved', version: 1 },
    ] })
  })
  try {
    const session = new CatalogSession('tag', 'test-csrf')
    const unsubscribe = session.subscribe(() => {})
    session.begin(base)
    session.change('name', 'Saved')
    const saving = session.save()
    session.begin(null)
    session.change('slug', 'should-not-change')
    await session.save()
    equal(session.snapshot().edit?.id, base.id)
    equal(session.snapshot().slug, base.slug)
    unsubscribe()
    response.resolve(Response.json({ ...base, name: 'Saved', version: 1 }))
    equal(await saving, 'saved')
    equal(writes, 1)
    equal(session.snapshot().dirty, false)
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('unknown catalog results retain their retry key across token updates and view subscriptions', async () => {
  const saved = entry('Retry')
  const keys: string[] = []
  const tokens: string[] = []
  const fetch = mock.method(globalThis, 'fetch', async (_path: unknown, init: RequestInit) => {
    if (init.method !== 'POST') {
      return await Promise.resolve(Response.json({ items: [saved] }))
    }
    const headers = new Headers(init.headers)
    keys.push(headers.get('idempotency-key') ?? '')
    tokens.push(headers.get('x-csrf-token') ?? '')
    if (keys.length === 1) {
      throw new Error('Connection lost after commit')
    }
    return await Promise.resolve(Response.json(saved))
  })
  try {
    const session = new CatalogSession('tag', 'old-token')
    session.change('name', saved.name)
    session.change('slug', saved.slug)
    await session.save()
    equal(session.snapshot().dirty, true)
    assert.match(session.snapshot().error, /Connection failed/)
    session.subscribe(() => {})()
    session.setToken('new-token')
    await session.refresh()
    await session.save()
    equal(keys.length, 2)
    assert.notEqual(keys[0], '')
    equal(keys[0], keys[1])
    deepEqual(tokens, ['old-token', 'new-token'])
    deepEqual(session.snapshot().data?.items, [saved])
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a clean catalog form never writes', async () => {
  const fetches: string[] = []
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown) => {
    fetches.push(typeof path === 'string' ? path : 'Unexpected request')
    return await Promise.resolve(Response.json({ items: [] }))
  })
  try {
    const session = new CatalogSession('tag', 'test-csrf')
    await session.save()
    session.begin(entry())
    await session.save()
    deepEqual(fetches, [])
    equal(session.snapshot().busy, false)
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('server catalog sessions do not share form state between requests', () => {
  const first = catalogSession('owner', 'tag', 'token')
  first.change('name', 'Server-local input')
  const second = catalogSession('owner', 'tag', 'token')
  assert.notEqual(first, second)
  equal(second.snapshot().name, '')
  equal(first.serverSnapshot().name, '')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('disposing a catalog session prevents CSRF renewal and replay of its in-flight save', async () => {
  const response = deferred<Response>()
  const requests: string[] = []
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown) => {
    requests.push(typeof path === 'string' ? path : 'Unexpected request')
    return await response.promise
  })
  try {
    const session = new CatalogSession('tag', 'old-owner-token', 'old-owner')
    session.change('name', 'Old owner input')
    session.change('slug', 'old-owner-input')
    const saving = session.save()
    session.dispose()
    response.resolve(Response.json({ code: 'CSRF_INVALID' }, { status: 403 }))
    await saving
    deepEqual(requests, ['/api/admin/catalog/tag'])
    equal(session.snapshot().name, 'Old owner input')
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('browser catalog sessions isolate kinds and owners and keep an unload warning while hidden', () => {
  const browser = new EventTarget()
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true })
  try {
    const first = catalogSession('first-owner', 'tag', 'token')
    first.change('name', 'Session draft')
    equal(catalogSession('first-owner', 'tag', 'updated-token'), first)
    equal(catalogSession('first-owner', 'series', 'token').snapshot().name, '')
    const unloading = new Event('beforeunload', { cancelable: true })
    browser.dispatchEvent(unloading)
    equal(unloading.defaultPrevented, true)
    const second = catalogSession('second-owner', 'tag', 'token')
    equal(second.snapshot().name, '')
    first.change('name', 'Old owner must stay disposed')
    equal(first.snapshot().name, 'Session draft')
    const cleanUnload = new Event('beforeunload', { cancelable: true })
    browser.dispatchEvent(cleanUnload)
    equal(cleanUnload.defaultPrevented, false)
    second.dispose()
  }
  finally {
    Reflect.deleteProperty(globalThis, 'window')
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
