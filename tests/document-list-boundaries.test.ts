import type { DocumentEntry } from '../src/features/documents/document-list-model'
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { defaultDocumentFilters } from '../src/content/document-list-query'
import { DocumentsController } from '../src/features/documents/document-list-model'
import { deepEqual, equal } from './assertions'

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

test('confirmed restoration removes its trash row and holds other writes until refresh settles', async () => {
  const target = entry('Restored document')
  const other = entry('Other deleted document')
  const paths: string[] = []
  let finish = (_response: Response): void => {}
  let started = (): void => {}
  const refreshing = new Promise<void>((resolve) => {
    started = resolve
  })
  let reads = 0
  let writes = 0
  const fetch = mock.method(globalThis, 'fetch', async (path: string, init: RequestInit) => {
    paths.push(path)
    if (init.method === 'POST') {
      writes++
      return Response.json({
        documentId: target.documentId,
        headRevisionId: target.headRevisionId,
        liveRevisionId: null,
        version: target.version + 1,
        liveGeneration: 0,
      })
    }
    if (++reads === 2) {
      return await new Promise<Response>((resolve) => {
        finish = resolve
        started()
      })
    }
    return Response.json({ items: reads === 1 ? [target, other] : [other], nextCursor: null })
  })
  try {
    const controller = new DocumentsController('csrf')
    await controller.load({ ...defaultDocumentFilters, state: 'deleted', q: 'document' })
    controller.setQuery('Unsubmitted search')
    const restored = controller.restore(target)
    await refreshing
    deepEqual(controller.snapshot().entries, [other])
    equal(controller.snapshot().mutation, target.documentId)
    equal(controller.snapshot().query, 'Unsubmitted search')
    await controller.restore(other)
    await controller.create('article')
    equal(writes, 1)
    finish(Response.json({ code: 'UNAVAILABLE' }, { status: 503 }))
    await restored
    equal(controller.snapshot().restored, true)
    equal(controller.snapshot().error, 'load')
    equal(controller.snapshot().mutation, null)
    deepEqual(controller.snapshot().entries, [other])
    await controller.retry()
    equal(controller.snapshot().error, null)
    equal(controller.snapshot().query, 'Unsubmitted search')
    equal(paths.at(-1), '/api/admin/documents?q=document&state=deleted')
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('refresh preserves unsubmitted search text while explicit filter changes update it', async () => {
  const paths: string[] = []
  const fetch = mock.method(globalThis, 'fetch', async (path: string) => {
    paths.push(path)
    return await Promise.resolve(Response.json({ items: [], nextCursor: null }))
  })
  try {
    const controller = new DocumentsController('csrf')
    await controller.load({ ...defaultDocumentFilters, q: 'Submitted' })
    controller.setQuery('Further typing')
    await controller.load()
    equal(controller.snapshot().query, 'Further typing')
    equal(controller.snapshot().filters.q, 'Submitted')
    equal(paths.at(-1), '/api/admin/documents?q=Submitted')
    await controller.load(defaultDocumentFilters)
    equal(controller.snapshot().query, '')
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('restoration distinguishes unknown network outcomes from definite maintenance refusals', async () => {
  let maintenance = false
  const fetch = mock.method(globalThis, 'fetch', async () => {
    if (!maintenance) {
      throw new TypeError('Disconnected after commit')
    }
    return await Promise.resolve(Response.json({ code: 'MAINTENANCE' }, { status: 503 }))
  })
  try {
    const controller = new DocumentsController('csrf')
    await controller.restore(entry('Unknown result'))
    equal(controller.snapshot().errorCode, 'MUTATION_OUTCOME_UNKNOWN')
    maintenance = true
    await controller.retry()
    equal(controller.snapshot().errorCode, 'MAINTENANCE')
  }
  finally {
    fetch.mock.restore()
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

for (const failed of [false, true]) {
  test(`a late pagination ${failed ? 'failure' : 'success'} cannot replace new filters`, async () => {
    const original = entry('Original')
    const current = entry('Current filter result')
    let finish = (_response: Response): void => {}
    const fetch = mock.method(globalThis, 'fetch', async (path: string) => {
      if (path.includes('cursor=')) {
        return await new Promise<Response>((resolve) => {
          finish = resolve
        })
      }
      return Response.json({
        items: path.includes('q=Current') ? [current] : [original],
        nextCursor: 'previous-page',
      })
    })
    try {
      const controller = new DocumentsController('csrf')
      await controller.load()
      const older = controller.more()
      await controller.load({ ...defaultDocumentFilters, q: 'Current' })
      finish(failed
        ? Response.json({ code: 'UNAVAILABLE' }, { status: 503 })
        : Response.json({ items: [original], nextCursor: null }))
      await older
      deepEqual(controller.snapshot().entries, [current])
      equal(controller.snapshot().error, null)
      equal(controller.snapshot().filters.q, 'Current')
      equal(controller.snapshot().cursor, 'previous-page')
    }
    finally {
      fetch.mock.restore()
    }
  }).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
}
