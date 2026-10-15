import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { acknowledgementSchema } from '../src/content/contracts'
import { Client } from '../src/features/editor/services/api-client'
import { deepEqual, equal } from './assertions'

test('owner-bound mutations do not retry with credentials belonging to another owner', async () => {
  const requests: string[] = []
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown, init: RequestInit) => {
    const target = typeof path === 'string' ? path : 'Unexpected request'
    requests.push(`${init.method ?? 'GET'}:${target}`)
    return await Promise.resolve(target === '/api/admin/session'
      ? Response.json({ ownerSub: 'new-owner', csrfToken: 'new-owner-token' })
      : Response.json({ code: 'CSRF_INVALID' }, { status: 403 }))
  })
  try {
    const client = new Client('old-owner-token', 'old-owner')
    await assert.rejects(client.write('/api/admin/documents', 'POST', { kind: 'article' }), {
      message: 'AUTH_INVALID',
      status: 401,
    })
    deepEqual(requests, ['POST:/api/admin/documents', 'GET:/api/admin/session'])
    equal(client.csrfToken, 'old-owner-token')
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('cancelling during CSRF renewal prevents the following mutation request', async () => {
  let resolve = (_response: Response): void => {}
  const renewal = new Promise<Response>((done) => {
    resolve = done
  })
  let started = (): void => {}
  const renewing = new Promise<void>((done) => {
    started = done
  })
  const requests: string[] = []
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown) => {
    const target = typeof path === 'string' ? path : 'Unexpected request'
    requests.push(target)
    if (target === '/api/admin/session') {
      started()
      return await renewal
    }
    return await Promise.resolve(Response.json({ code: 'CSRF_INVALID' }, { status: 403 }))
  })
  try {
    const controller = new AbortController()
    const client = new Client('old-token')
    const request = { path: '/api/admin/documents', method: 'POST' as const, body: { kind: 'article' } }
    const saving = client.mutate({ ...request, schema: acknowledgementSchema, signal: controller.signal })
    const rejected = assert.rejects(saving, { message: 'CONNECTION_FAILED' })
    await renewing
    controller.abort()
    resolve(Response.json({ ownerSub: 'same-owner', csrfToken: 'renewed-token' }))
    await rejected
    deepEqual(requests, ['/api/admin/documents', '/api/admin/session'])
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('same-owner CSRF renewal keeps the original mutation key and uses the renewed token', async () => {
  const keys: string[] = []
  const tokens: string[] = []
  const result = {
    documentId: crypto.randomUUID(),
    version: 0,
    headRevisionId: crypto.randomUUID(),
    liveRevisionId: null,
    liveGeneration: 0,
  }
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown, init: RequestInit) => {
    if (path === '/api/admin/session') {
      return await Promise.resolve(Response.json({ ownerSub: 'same-owner', csrfToken: 'renewed-token' }))
    }
    const headers = new Headers(init.headers)
    keys.push(headers.get('idempotency-key') ?? '')
    tokens.push(headers.get('x-csrf-token') ?? '')
    return await Promise.resolve(keys.length === 1
      ? Response.json({ code: 'CSRF_INVALID' }, { status: 403 })
      : Response.json(result))
  })
  try {
    const client = new Client('old-token', 'same-owner')
    deepEqual(await client.write('/api/admin/documents', 'POST', { kind: 'article' }), result)
    deepEqual(tokens, ['old-token', 'renewed-token'])
    equal(keys.length, 2)
    assert.notEqual(keys[0], '')
    equal(keys[0], keys[1])
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('caller-owned autosave keys do not exhaust the manual mutation retry queue', async () => {
  const result = {
    documentId: crypto.randomUUID(),
    version: 1,
    headRevisionId: crypto.randomUUID(),
    liveRevisionId: null,
    liveGeneration: 0,
  }
  const keys: string[] = []
  const fetch = mock.method(globalThis, 'fetch', async (_path: unknown, init: RequestInit) => {
    keys.push(new Headers(init.headers).get('idempotency-key') ?? '')
    if (init.method === 'PUT') {
      throw new TypeError('Offline')
    }
    return await Promise.resolve(Response.json(result))
  })
  try {
    const client = new Client('test-csrf')
    for (let version = 0; version < 10; version++) {
      const key = crypto.randomUUID()
      const packet = {
        path: '/api/admin/documents/test/revisions',
        method: 'PUT' as const,
        body: { expectedVersion: version },
        key,
        schema: acknowledgementSchema,
      }
      await assert.rejects(client.mutate(packet), { message: 'CONNECTION_FAILED' })
      await assert.rejects(client.mutate(packet), { message: 'CONNECTION_FAILED' })
      equal(keys.at(-1), key)
      equal(keys.at(-2), key)
      const cancelled = await client.write('/api/admin/documents/test/schedule', 'DELETE', { expectedVersion: version })
      deepEqual(cancelled, result)
    }
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('manual mutation retries preserve the request ID after an unknown network result', async () => {
  const keys: string[] = []
  const result = {
    documentId: crypto.randomUUID(),
    version: 0,
    headRevisionId: crypto.randomUUID(),
    liveRevisionId: null,
    liveGeneration: 0,
  }
  const fetch = mock.method(
    globalThis,
    'fetch',
    async (_path: unknown, init: RequestInit) => {
      keys.push(new Headers(init.headers).get('idempotency-key') ?? '')
      if (keys.length === 1) {
        throw new TypeError('Disconnected after commit')
      }
      return await Promise.resolve(Response.json(result))
    },
  )
  try {
    const client = new Client('test-csrf')
    await assert.rejects(client.write('/api/admin/documents', 'POST', { kind: 'article' }), {
      message: 'CONNECTION_FAILED',
      status: 0,
    })
    deepEqual(await client.write('/api/admin/documents', 'POST', { kind: 'article' }), result)
    equal(keys[0], keys[1])
    assert.notEqual(keys[0], '')
    await client.write('/api/admin/documents', 'POST', { kind: 'article' })
    assert.notEqual(keys[1], keys[2])
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('definite maintenance rejections release retry keys for different revisions', async () => {
  const keys: string[] = []
  const result = {
    documentId: crypto.randomUUID(),
    version: 1,
    headRevisionId: crypto.randomUUID(),
    liveRevisionId: null,
    liveGeneration: 0,
  }
  let maintenance = true
  const fetch = mock.method(globalThis, 'fetch', async (_path: unknown, init: RequestInit) => {
    keys.push(new Headers(init.headers).get('idempotency-key') ?? '')
    return await Promise.resolve(maintenance
      ? Response.json({ code: 'MAINTENANCE' }, { status: 503 })
      : Response.json(result))
  })
  try {
    const client = new Client('test-csrf')
    for (let revision = 0; revision < 10; revision++) {
      await assert.rejects(client.write('/api/admin/documents/test/restore', 'POST', {
        expectedVersion: 0,
        revisionId: revision,
      }), { message: 'MAINTENANCE', status: 503 })
    }
    maintenance = false
    deepEqual(await client.write('/api/admin/documents/test/restore', 'POST', {
      expectedVersion: 0,
      revisionId: 0,
    }), result)
    equal(keys.length, 11)
    assert.notEqual(keys[0], keys[10])
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
