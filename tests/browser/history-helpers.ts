import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { acknowledgementSchema, sessionSchema } from '../../src/content/contracts'
import { emptyDocument } from '../../src/content/document'
import { writeDocument } from './helpers'

export async function mutate(page: Page, path: string, body: unknown, method = 'POST'):
Promise<ReturnType<typeof acknowledgementSchema.parse>> {
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  const response = await page.request.fetch(path, {
    method,
    data: body,
    headers: {
      'origin': new URL(page.url()).origin,
      'x-csrf-token': session.csrfToken,
      'idempotency-key': crypto.randomUUID(),
    },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return acknowledgementSchema.parse(await response.json())
}
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
