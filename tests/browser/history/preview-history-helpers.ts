import type { Page } from '@playwright/test'
import type { Recovery } from '@/features/editor/core/recovery'
import { expect } from '@playwright/test'
import { acknowledgementSchema, sessionSchema } from '@/content/contracts'
import { writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'

export async function setRecovery(page: Page, ack: ReturnType<typeof acknowledgementSchema.parse>): Promise<void> {
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  const snapshot: Recovery = {
    owner: session.ownerSub,
    documentId: ack.documentId,
    baseRevisionId: ack.headRevisionId,
    editSeq: 1,
    savedAt: Date.now(),
    document: fixture('A local recovery copy that was never sent to the server'),
  }
  await page.evaluate(async (recovery) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ztd.blog.cms.recovery.v1', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots')
      request.onerror = () => reject(request.error ?? new Error('Could not open local recovery'))
      request.onsuccess = () => resolve(request.result)
    })
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('snapshots', 'readwrite')
        transaction.objectStore('snapshots').put(
          recovery,
          `${recovery.owner}:${recovery.documentId}:blog-blocknote-v1`,
        )
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not write local recovery'))
        transaction.onabort = () => reject(transaction.error ?? new Error('Local recovery write was aborted'))
      })
    }
    finally {
      db.close()
    }
  }, snapshot)
}

export async function historyFixture(page: Page): Promise<{
  first: ReturnType<typeof acknowledgementSchema.parse>
  latest: ReturnType<typeof acknowledgementSchema.parse>
  blockId: string
}> {
  const document = fixture('The historical paragraph before its edit')
  const first = await writeDocument(page, document)
  const block = document.blocks[0]
  if (block === undefined) {
    throw new Error('The history fixture has no paragraph')
  }
  document.meta.title = 'The current draft title'
  block.content = [
    { type: 'text', text: 'The current paragraph after its edit', styles: {} },
  ]
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  const response = await page.request.put(`/api/admin/documents/${first.documentId}/revisions`, {
    data: {
      expectedVersion: first.version,
      baseRevisionId: first.headRevisionId,
      reason: 'manual',
      document,
    },
    headers: {
      'origin': new URL(page.url()).origin,
      'x-csrf-token': session.csrfToken,
      'idempotency-key': crypto.randomUUID(),
    },
  })
  expect(response.ok(), await response.text()).toBe(true)
  const latest = acknowledgementSchema.parse(await response.json())
  await page.goto(`/admin/documents/${first.documentId}`)
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
  return { first, latest, blockId: block.id }
}
