import type { Page } from '@playwright/test'
import type { acknowledgementSchema } from '@/content/contracts'
import { expect } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { mutate } from '~/tests/support/browser/api'
import { writeDocument } from '~/tests/support/browser/document'

export async function historyFixture(page: Page): Promise<{
  path: string
  first: ReturnType<typeof acknowledgementSchema.parse>
  latest: ReturnType<typeof acknowledgementSchema.parse>
  slug: string
}> {
  const document = emptyDocument()
  const slug = `history-${crypto.randomUUID()}`
  document.meta.title = 'First historical title'
  document.meta.slug = slug
  const block = document.blocks[0]
  expect(block).toBeDefined()
  if (block !== undefined) {
    block.content = [
      { type: 'text', text: 'First historical body', styles: {} },
    ]
  }
  const first = await writeDocument(page, document)
  const path = `/api/admin/documents/${first.documentId}`
  const live = await mutate(page, `${path}/publish`, {
    expectedVersion: first.version,
    expectedLiveGeneration: first.liveGeneration,
    revisionId: first.headRevisionId,
  })
  document.meta.title = 'Latest draft title'
  document.meta.slug = `${slug}-updated`
  if (block !== undefined) {
    block.content = [
      { type: 'text', text: 'Latest draft body', styles: {} },
    ]
  }
  const latest = await mutate(page, `${path}/revisions`, {
    expectedVersion: live.version,
    baseRevisionId: live.headRevisionId,
    reason: 'manual',
    document,
  }, 'PUT')
  await page.goto(`/admin/documents/${first.documentId}/history`)
  await expect(page.getByRole('heading', { name: 'Revision history', exact: true })).toBeVisible()
  return { path, first, latest, slug }
}
