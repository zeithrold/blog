import type { MediaAsset } from '../src/features/media/media-types'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { Client } from '../src/features/editor/services/api-client'
import { uploadMedia } from '../src/features/editor/services/media-service'
import { mediaTransferSession } from '../src/features/editor/services/media-transfer-session'
import { deepEqual, equal } from './assertions'

function descriptor(id: string, state: MediaAsset['state'] = 'ready'): MediaAsset {
  const file = { filename: 'test.txt', bytes: 4, type: 'text/plain', sha256: 'a'.repeat(64) }
  return { ...file, assetId: id, state, url: `/assets/${id}`, role: 'file' }
}

test('unknown media transfers recover the original ready asset without allocating or uploading twice', async () => {
  let allocations = 0
  let transfers = 0
  let checks = 0
  let id = crypto.randomUUID()
  const fetch = mock.method(globalThis, 'fetch', async (_path: unknown, init: RequestInit) => {
    if (init.method === 'POST') {
      allocations++
      id = crypto.randomUUID()
      return await Promise.resolve(Response.json({ assetId: id, state: 'uploading', uploadPath: `/upload/${id}` }))
    }
    if (init.method === 'PUT') {
      if (++transfers === 1) {
        throw new Error('Response lost after upload')
      }
      return await Promise.resolve(Response.json(descriptor(id)))
    }
    checks++
    return await Promise.resolve(checks <= 2
      ? Response.json({ code: 'UNAVAILABLE' }, { status: 503 })
      : Response.json(descriptor(id)))
  })
  try {
    const client = new Client('token')
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    await assert.rejects(uploadMedia(client, file, 'file'), { message: 'UPLOAD_OUTCOME_UNKNOWN' })
    await assert.rejects(uploadMedia(client, file, 'file'), { message: 'UPLOAD_OUTCOME_UNKNOWN' })
    const recovered = await uploadMedia(client, file, 'file')
    equal(recovered.assetId, id)
    equal(allocations, 1)
    equal(transfers, 1)
    const next = await uploadMedia(client, file, 'file')
    assert.notEqual(next.assetId, recovered.assetId)
    equal(allocations, 2)
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('interrupted transfers resume their path; rejected transfers get a fresh allocation', async () => {
  for (const state of ['uploading', 'rejected'] as const) {
    let allocations = 0
    const paths: unknown[] = []
    let id = crypto.randomUUID()
    const fetch = mock.method(globalThis, 'fetch', async (path: unknown, init: RequestInit) => {
      if (init.method === 'POST') {
        allocations++
        id = crypto.randomUUID()
        return await Promise.resolve(Response.json({ assetId: id, state: 'uploading', uploadPath: `/upload/${id}` }))
      }
      if (init.method === 'PUT') {
        paths.push(path)
        if (paths.length === 1) {
          throw new Error('Disconnected')
        }
        return await Promise.resolve(Response.json(descriptor(id)))
      }
      return await Promise.resolve(Response.json(descriptor(id, state)))
    })
    try {
      const client = new Client('token')
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      await assert.rejects(uploadMedia(client, file, 'file'), { message: 'CONNECTION_FAILED' })
      const recovered = await uploadMedia(client, file, 'file')
      equal(recovered.assetId, id)
      equal(allocations, state === 'uploading' ? 1 : 2)
      equal(paths.length, 2)
      equal(paths[0] === paths[1], state === 'uploading')
    }
    finally {
      fetch.mock.restore()
    }
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('expired media transfers retain their explanation and start a fresh upload on retry', async () => {
  let allocations = 0
  let transfers = 0
  let id = crypto.randomUUID()
  const fetch = mock.method(globalThis, 'fetch', async (_path: unknown, init: RequestInit) => {
    if (init.method === 'POST') {
      allocations++
      id = crypto.randomUUID()
      return await Promise.resolve(Response.json({ assetId: id, state: 'uploading', uploadPath: `/upload/${id}` }))
    }
    transfers++
    return await Promise.resolve(transfers === 1
      ? Response.json({ code: 'UPLOAD_SESSION_EXPIRED' }, { status: 409 })
      : Response.json(descriptor(id)))
  })
  try {
    const client = new Client('token')
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    await assert.rejects(uploadMedia(client, file, 'file'), { message: 'UPLOAD_SESSION_EXPIRED' })
    deepEqual(await uploadMedia(client, file, 'file'), descriptor(id))
    equal(allocations, 2)
    equal(transfers, 2)
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('resumed media transfers renew CSRF credentials without changing their allocation or PUT path', async () => {
  const id = crypto.randomUUID()
  const tokens: (string | null)[] = []
  let allocations = 0
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown, init: RequestInit) => {
    if (path === '/api/admin/session') {
      return await Promise.resolve(Response.json({ ownerSub: 'same-owner', csrfToken: 'new-token' }))
    }
    if (init.method === 'POST') {
      allocations++
      return await Promise.resolve(Response.json({ assetId: id, state: 'uploading', uploadPath: `/upload/${id}` }))
    }
    if (init.method === 'PUT') {
      equal(path, `/upload/${id}`)
      tokens.push(new Headers(init.headers).get('x-csrf-token'))
      if (tokens.length === 1) {
        throw new Error('Disconnected')
      }
      return await Promise.resolve(tokens.length === 2
        ? Response.json({ code: 'CSRF_INVALID' }, { status: 403 })
        : Response.json(descriptor(id)))
    }
    return await Promise.resolve(Response.json(descriptor(id, 'uploading')))
  })
  try {
    const client = new Client('old-token', 'same-owner')
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    await assert.rejects(uploadMedia(client, file, 'file'), { message: 'CONNECTION_FAILED' })
    equal((await uploadMedia(client, file, 'file')).assetId, id)
    equal(allocations, 1)
    deepEqual(tokens, [
      'old-token',
      'old-token',
      'new-token',
    ])
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('media transfer state is isolated by client, file and role', () => {
  const first = new Client('first')
  const second = new Client('second')
  const file = new File(['test'], 'test.png', { type: 'image/png' })
  const original = mediaTransferSession(first, file, 'image')
  original.allocation = { assetId: crypto.randomUUID(), state: 'uploading', uploadPath: '/original' }
  equal(mediaTransferSession(first, file, 'image'), original)
  equal(mediaTransferSession(first, file, 'poster').allocation, null)
  equal(mediaTransferSession(second, file, 'image').allocation, null)
  equal(mediaTransferSession(first, new File(['test'], 'test.png'), 'image').allocation, null)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('missing original uploads can start fresh while definitive maintenance errors remain visible', async () => {
  for (const missing of [true, false]) {
    const client = new Client('token')
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const id = crypto.randomUUID()
    mediaTransferSession(client, file, 'file').allocation = {
      assetId: crypto.randomUUID(),
      state: 'uploading',
      uploadPath: '/original',
    }
    const requests: (string | undefined)[] = []
    const fetch = mock.method(globalThis, 'fetch', async (_path: unknown, init: RequestInit) => {
      requests.push(init.method)
      if (init.method === undefined) {
        return await Promise.resolve(missing
          ? Response.json({ code: 'ASSET_NOT_FOUND' }, { status: 404 })
          : Response.json(descriptor(id, 'uploading')))
      }
      if (init.method === 'POST') {
        return await Promise.resolve(Response.json({ assetId: id, state: 'uploading', uploadPath: `/upload/${id}` }))
      }
      return await Promise.resolve(missing
        ? Response.json(descriptor(id))
        : Response.json({ code: 'MAINTENANCE' }, { status: 503 }))
    })
    try {
      if (missing) {
        equal((await uploadMedia(client, file, 'file')).assetId, id)
        deepEqual(requests, [
          undefined,
          'POST',
          'PUT',
        ])
      }
      else {
        await assert.rejects(uploadMedia(client, file, 'file'), { message: 'MAINTENANCE' })
        deepEqual(requests, [undefined, 'PUT'])
      }
    }
    finally {
      fetch.mock.restore()
    }
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
