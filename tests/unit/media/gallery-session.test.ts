import type { MediaAsset } from '@/features/media/media-types'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { GallerySession } from '@/features/media/gallery-session'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

function deferred<T>() {
  let resolve = (_value: T): void => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function asset(): MediaAsset {
  const assetId = crypto.randomUUID()
  return {
    assetId,
    filename: 'test.txt',
    bytes: 4,
    type: 'text/plain',
    sha256: 'a'.repeat(64),
    state: 'ready',
    url: `/assets/${assetId}`,
    role: 'file',
  }
}

function file(): File {
  return new File(['test'], 'test.txt', { type: 'text/plain' })
}

test('a delayed gallery listing cannot erase an upload completed after the read began', async () => {
  const listed = deferred<Response>()
  const reading = deferred<boolean>()
  const ready = asset()
  const session = new GallerySession('owner', 'token')
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown, init: RequestInit) => {
    if (path === '/api/admin/session') {
      return Response.json({ ownerSub: 'owner', csrfToken: 'fresh-token' })
    }
    if (init.method === 'POST') {
      return Response.json({ assetId: ready.assetId, state: 'uploading', uploadPath: '/transfer' })
    }
    if (init.method === 'PUT') {
      return Response.json(ready)
    }
    reading.resolve(true)
    return await listed.promise
  })
  try {
    const loading = session.load()
    await reading.promise
    session.queue.enqueue([
      file(),
    ], 'file')
    await session.queue.start()
    listed.resolve(Response.json({ items: [], nextCursor: null }))
    await loading
    deepEqual(session.snapshot().items, [ready])
    equal(session.snapshot().loaded, true)
    equal(session.snapshot().loading, false)
  }
  finally {
    session.dispose()
    fetch.mock.restore()
  }
}).catch((error: unknown) => { throw error })

test('gallery stops the entire file batch if CSRF renewal belongs to another owner', async () => {
  let changed = false
  const requests: string[] = []
  const session = new GallerySession('original-owner', 'old-token')
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown, init: RequestInit) => {
    requests.push(`${init.method ?? 'GET'}:${(typeof path === 'string' ? path : 'Unexpected request')}`)
    if (path === '/api/admin/session') {
      return await Promise.resolve(Response.json({
        ownerSub: changed ? 'other-owner' : 'original-owner',
        csrfToken: 'fresh-token',
      }))
    }
    changed = true
    return await Promise.resolve(Response.json({ code: 'CSRF_INVALID' }, { status: 403 }))
  })
  try {
    session.queue.enqueue([
      file(),
      new File(['next'], 'next.txt', { type: 'text/plain' }),
    ], 'file')
    await session.queue.start()
    deepEqual(requests, [
      'GET:/api/admin/session',
      'POST:/api/admin/assets',
      'GET:/api/admin/session',
    ])
    equal(session.queue.snapshot().items.length, 0)
    equal(session.queue.snapshot().running, false)
    equal(session.snapshot().items.length, 0)
    assert.match(session.snapshot().error, /session expired/)
  }
  finally {
    session.dispose()
    fetch.mock.restore()
  }
}).catch((error: unknown) => { throw error })

test('a later authoritative listing can remove a completed upload from the gallery', async () => {
  const ready = asset()
  const session = new GallerySession('owner', 'token')
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown, init: RequestInit) => {
    if (path === '/api/admin/session') {
      return await Promise.resolve(Response.json({ ownerSub: 'owner', csrfToken: 'token' }))
    }
    if (init.method === 'POST') {
      return await Promise.resolve(Response.json({
        assetId: ready.assetId,
        state: 'uploading',
        uploadPath: '/transfer',
      }))
    }
    return await Promise.resolve(Response.json(init.method === 'PUT' ? ready : { items: [], nextCursor: null }))
  })
  try {
    session.queue.enqueue([
      file(),
    ], 'file')
    await session.queue.start()
    deepEqual(session.snapshot().items, [ready])
    await session.load()
    equal(session.snapshot().items.length, 0)
    equal(session.queue.snapshot().items[0]?.state, 'complete')
  }
  finally {
    session.dispose()
    fetch.mock.restore()
  }
}).catch((error: unknown) => { throw error })

test('disposing during file reading prevents allocation after the bytes arrive', async () => {
  const bytes = deferred<ArrayBuffer>()
  const hashing = deferred<boolean>()
  const selected = file()
  const session = new GallerySession('owner', 'token')
  const paths: string[] = []
  const read = mock.method(selected, 'arrayBuffer', async () => {
    hashing.resolve(true)
    return await bytes.promise
  })
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown) => {
    paths.push((typeof path === 'string' ? path : 'Unexpected request'))
    return await Promise.resolve(Response.json({ ownerSub: 'owner', csrfToken: 'fresh-token' }))
  })
  try {
    session.queue.enqueue([selected], 'file')
    const uploading = session.queue.start()
    await hashing.promise
    session.dispose()
    bytes.resolve(new ArrayBuffer(4))
    await uploading
    deepEqual(paths, ['/api/admin/session'])
    equal(session.queue.snapshot().items.length, 0)
  }
  finally {
    session.dispose()
    read.mock.restore()
    fetch.mock.restore()
  }
}).catch((error: unknown) => { throw error })

test('unknown transfer reconciliation checks ownership before reading the original asset', async () => {
  const session = new GallerySession('original-owner', 'token')
  const ready = asset()
  const requests: string[] = []
  let changed = false
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown, init: RequestInit) => {
    requests.push(typeof path === 'string' ? path : 'Unexpected request')
    if (path === '/api/admin/session') {
      return await Promise.resolve(Response.json({
        ownerSub: changed ? 'other-owner' : 'original-owner',
        csrfToken: 'fresh-token',
      }))
    }
    if (init.method === 'POST') {
      return await Promise.resolve(Response.json({
        assetId: ready.assetId,
        state: 'uploading',
        uploadPath: '/transfer',
      }))
    }
    changed = true
    throw new TypeError('Connection lost after transfer')
  })
  try {
    session.queue.enqueue([
      file(),
    ], 'file')
    await session.queue.start()
    deepEqual(requests, [
      '/api/admin/session',
      '/api/admin/assets',
      '/transfer',
      '/api/admin/session',
    ])
    equal(session.isDisposed(), true)
    equal(session.queue.snapshot().items.length, 0)
    assert.match(session.snapshot().error, /session expired/)
  }
  finally {
    session.dispose()
    fetch.mock.restore()
  }
}).catch((error: unknown) => { throw error })

test('disposing during a PUT ignores its late success and never sends the next file', async () => {
  const ready = asset()
  const response = deferred<Response>()
  const transferring = deferred<boolean>()
  const session = new GallerySession('owner', 'token')
  const paths: string[] = []
  let signal: AbortSignal | null | undefined
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown, init: RequestInit) => {
    paths.push((typeof path === 'string' ? path : 'Unexpected request'))
    if (path === '/api/admin/session') {
      return Response.json({ ownerSub: 'owner', csrfToken: 'fresh-token' })
    }
    if (init.method === 'POST') {
      return Response.json({ assetId: ready.assetId, state: 'uploading', uploadPath: '/transfer' })
    }
    signal = init.signal
    transferring.resolve(true)
    return await response.promise
  })
  try {
    session.queue.enqueue([
      file(),
      new File(['next'], 'next.txt', { type: 'text/plain' }),
    ], 'file')
    const uploading = session.queue.start()
    await transferring.promise
    session.dispose()
    response.resolve(Response.json(ready))
    await uploading
    equal(signal?.aborted, true)
    deepEqual(paths, [
      '/api/admin/session',
      '/api/admin/assets',
      '/transfer',
    ])
    equal(session.snapshot().items.length, 0)
    equal(session.queue.snapshot().items.length, 0)
  }
  finally {
    session.dispose()
    fetch.mock.restore()
  }
}).catch((error: unknown) => { throw error })
