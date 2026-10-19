import type { DocumentEntry } from '@/features/documents/document-list-model'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { defaultDocumentFilters, documentListPath } from '@/content/document-list-query'
import { DocumentsController } from '@/features/documents/document-list-model'
import { listCursor, readDocumentListQuery } from '@/server/documents/document-list-query'
import { Problem } from '@/server/http/problem'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

function checked(name: string, run: () => Promise<void> | void): void {
  test(name, run).catch((error: unknown) => {
    assert.fail(error instanceof Error ? error.message : 'Test failed')
  })
}
function entry(title: string): DocumentEntry {
  return {
    documentId: crypto.randomUUID(),
    kind: 'article',
    title,
    version: 1,
    headRevisionId: crypto.randomUUID(),
    liveRevisionId: null,
    updatedAt: 1234,
  }
}
function page(items: DocumentEntry[], nextCursor: string | null = null): Response {
  return Response.json({ items, nextCursor })
}
checked('document queries reject unknown/duplicate fields and filter-incompatible cursors', () => {
  const filters = { ...defaultDocumentFilters, q: '中文 %_"', kind: 'page' as const }
  const position = { time: 1234, id: crypto.randomUUID() }
  const token = listCursor(position, filters)
  const path = documentListPath(filters, token)
  const parsed = readDocumentListQuery(new URL(path, 'https://example.test').searchParams)
  deepEqual(parsed, { filters, cursor: position })
  const invalid = [
    'unknown=1',
    'q=one&q=two',
    'kind=video',
    'state=scheduled',
    `q=${'x'.repeat(121)}`,
    'cursor=v1.invalid',
    `q=changed&cursor=${encodeURIComponent(token)}`,
    `kind=page&cursor=${position.time}:${position.id}`,
    `cursor=1e3:${position.id}`,
  ]
  for (const query of invalid) {
    assert.throws(() => readDocumentListQuery(new URLSearchParams(query)), (error: unknown) =>
      error instanceof Problem && error.status === 400 && error.code === 'INVALID_QUERY')
  }
  deepEqual(readDocumentListQuery(new URLSearchParams(`cursor=${position.time}:${position.id}`)), {
    filters: defaultDocumentFilters,
    cursor: position,
  })
})

checked('trash restore retries the same mutation after an unknown result and then refreshes', async () => {
  const deleted = entry('Restorable document')
  const keys: string[] = []
  const bodies: (BodyInit | null | undefined)[] = []
  const fetch = mock.method(globalThis, 'fetch', async (_path: string, init: RequestInit) => {
    if (init.method === 'POST') {
      keys.push(new Headers(init.headers).get('idempotency-key') ?? '')
      bodies.push(init.body)
      if (keys.length === 1) {
        throw new TypeError('Connection lost after commit')
      }
      return await Promise.resolve(Response.json({
        documentId: deleted.documentId,
        headRevisionId: deleted.headRevisionId,
        liveRevisionId: null,
        version: deleted.version + 1,
        liveGeneration: 0,
      }))
    }
    return await Promise.resolve(page([]))
  })
  try {
    const controller = new DocumentsController('csrf')
    await controller.restore(deleted)
    equal(controller.snapshot().error, 'restore')
    await controller.retry()
    equal(keys.length, 2)
    equal(keys[0], keys[1])
    equal(bodies[0], bodies[1])
    equal(controller.snapshot().restored, true)
    equal(controller.snapshot().loaded, true)
    equal(controller.snapshot().mutation, null)
  }
  finally {
    fetch.mock.restore()
  }
})

checked('a late response never replaces the newer filter results', async () => {
  let finish: ((response: Response) => void) | undefined
  const late = entry('Late document')
  const current = entry('Current document')
  const fetch = mock.method(globalThis, 'fetch', async (path: string) => {
    if (path === '/api/admin/documents') {
      return await new Promise<Response>((resolve) => {
        finish = resolve
      })
    }
    return await Promise.resolve(page([current]))
  })
  try {
    const controller = new DocumentsController('csrf')
    const first = controller.load()
    await controller.load({ ...defaultDocumentFilters, q: 'Current' })
    assert.ok(finish !== undefined)
    finish(page([late], '1234:late'))
    await first
    deepEqual(controller.snapshot().entries, [current])
    equal(controller.snapshot().cursor, null)
    equal(controller.snapshot().filters.q, 'Current')
  }
  finally {
    fetch.mock.restore()
  }
})

checked('search drafts share controller state and list responses preserve further typing', async () => {
  let finish: ((response: Response) => void) | undefined
  const fetch = mock.method(globalThis, 'fetch', async (path: string) => {
    if (path.includes('q=Submitted')) {
      return await new Promise<Response>((resolve) => {
        finish = resolve
      })
    }
    return await Promise.resolve(page([]))
  })
  try {
    const controller = new DocumentsController('csrf')
    controller.setQuery('  Submitted  ')
    const submitted = controller.load({ ...defaultDocumentFilters, q: controller.snapshot().query })
    equal(controller.snapshot().filters.q, 'Submitted')
    equal(controller.snapshot().query, 'Submitted')
    controller.setQuery('Further typing')
    assert.ok(finish !== undefined)
    finish(page([
      entry('Submitted document'),
    ]))
    await submitted
    equal(controller.snapshot().query, 'Further typing')
    equal(controller.snapshot().filters.q, 'Submitted')
    await controller.load(defaultDocumentFilters)
    equal(controller.snapshot().query, '')
    deepEqual(controller.snapshot().filters, defaultDocumentFilters)
  }
  finally {
    fetch.mock.restore()
  }
})

checked('pagination failure keeps entries and retries the same cursor without duplicates', async () => {
  const first = entry('First')
  const second = entry('Second')
  const paths: string[] = []
  const fetch = mock.method(globalThis, 'fetch', async (path: string) => {
    paths.push(path)
    if (paths.length === 2) {
      throw new TypeError('Connection lost')
    }
    return await Promise.resolve(paths.length === 1
      ? page([first], '1234:next')
      : page([first, second]))
  })
  try {
    const controller = new DocumentsController('csrf')
    await controller.load()
    await controller.more()
    equal(controller.snapshot().error, 'more')
    deepEqual(controller.snapshot().entries, [first])
    equal(controller.snapshot().cursor, '1234:next')
    await controller.retry()
    equal(paths[1], paths[2])
    deepEqual(controller.snapshot().entries, [first, second])
    equal(controller.snapshot().cursor, null)
    equal(controller.snapshot().error, null)
    await controller.load({ ...defaultDocumentFilters, q: 'Second' })
    equal(paths.at(-1), '/api/admin/documents?q=Second')
  }
  finally {
    fetch.mock.restore()
  }
})

checked('failed initial load can recover and cancellation ignores a pending response', async () => {
  let finish: ((response: Response) => void) | undefined
  let requests = 0
  const fetch = mock.method(globalThis, 'fetch', async () => {
    if (++requests === 1) {
      return await Promise.resolve(Response.json({ code: 'MAINTENANCE' }, { status: 503 }))
    }
    if (requests === 3) {
      return await new Promise<Response>((resolve) => {
        finish = resolve
      })
    }
    return await Promise.resolve(page([]))
  })
  try {
    const controller = new DocumentsController('csrf')
    await controller.load()
    equal(controller.snapshot().loaded, false)
    equal(controller.snapshot().errorCode, 'MAINTENANCE')
    await controller.retry()
    equal(controller.snapshot().loaded, true)
    equal(controller.snapshot().error, null)
    const pending = controller.load()
    controller.cancel()
    assert.ok(finish !== undefined)
    finish(page([
      entry('Unmounted'),
    ]))
    await pending
    deepEqual(controller.snapshot().entries, [])
  }
  finally {
    fetch.mock.restore()
  }
})
