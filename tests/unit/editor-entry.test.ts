import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { emptyDocument } from '@/content/document'
import { loadEditorEntry } from '@/features/editor/services/editor-entry'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

test('editor entry obtains current credentials and a fresh document without using the route snapshot', async () => {
  const documentId = crypto.randomUUID()
  const document = emptyDocument()
  document.meta.title = 'Current server title'
  const latest = {
    documentId,
    version: 9,
    headRevisionId: crypto.randomUUID(),
    liveRevisionId: null,
    liveGeneration: 0,
    kind: 'article',
    livePath: null,
    document,
  }
  const paths: unknown[] = []
  const controller = new AbortController()
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown, options: RequestInit) => {
    paths.push(path)
    equal(options.cache, 'no-store')
    equal(options.signal, controller.signal)
    return await Promise.resolve(Response.json(path === '/api/admin/session'
      ? { ownerSub: 'current-owner', csrfToken: 'fresh-token' }
      : latest))
  })
  try {
    const result = await loadEditorEntry(documentId, 'current-owner', controller.signal)
    deepEqual(result, { initial: latest, owner: 'current-owner', csrfToken: 'fresh-token' })
    deepEqual(paths, [
      '/api/admin/session',
      `/api/admin/documents/${documentId}`,
    ])
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('an editor route from a different owner cannot fetch a document under the new credentials', async () => {
  const paths: unknown[] = []
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown) => {
    paths.push(path)
    return await Promise.resolve(Response.json({ ownerSub: 'new-owner', csrfToken: 'new-token' }))
  })
  try {
    await assert.rejects(loadEditorEntry(crypto.randomUUID(), 'old-owner', new AbortController().signal), {
      message: 'AUTH_INVALID',
      status: 401,
    })
    deepEqual(paths, ['/api/admin/session'])
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('leaving during session loading prevents a late document request', async () => {
  const paths: unknown[] = []
  let release = (_response: Response): void => {}
  const held = new Promise<Response>((resolve) => {
    release = resolve
  })
  const fetch = mock.method(globalThis, 'fetch', async (path: unknown) => {
    paths.push(path)
    return await held
  })
  try {
    const controller = new AbortController()
    const loading = loadEditorEntry(crypto.randomUUID(), 'owner', controller.signal)
    const rejected = assert.rejects(loading, { name: 'AbortError' })
    controller.abort()
    release(Response.json({ ownerSub: 'owner', csrfToken: 'token' }))
    await rejected
    deepEqual(paths, ['/api/admin/session'])
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
