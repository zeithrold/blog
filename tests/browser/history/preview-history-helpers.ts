import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { acknowledgementSchema } from '@/contracts/documents'
import { sessionSchema } from '@/contracts/session'
import { writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'

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
