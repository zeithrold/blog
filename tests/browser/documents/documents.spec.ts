import type { Locator, Page } from '@playwright/test'
import { acknowledgementSchema, openDocumentSchema, sessionSchema } from '@/content/contracts'
import { expect, test } from '~/tests/support/browser/test'

type Ack = ReturnType<typeof acknowledgementSchema.parse>
async function mutation(page: Page, path: string, body: unknown, method = 'POST'): Promise<Ack> {
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
async function seed(page: Page, title: string, kind: 'article' | 'page'): Promise<Ack> {
  const created = await mutation(page, '/api/admin/documents', { kind })
  const path = `/api/admin/documents/${created.documentId}`
  const opened = openDocumentSchema.parse(await (await page.request.get(path)).json())
  opened.document.meta.title = title
  opened.document.meta.slug = `browser-${created.documentId}`
  return await mutation(page, `${path}/revisions`, {
    expectedVersion: opened.version,
    baseRevisionId: opened.headRevisionId,
    reason: 'manual',
    document: opened.document,
  }, 'PUT')
}
async function search(page: Page, title: string): Promise<void> {
  await page.getByRole('searchbox', { name: 'Search by title' }).fill(title)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
}

async function filter(page: Page, name: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function verifyActiveFilters(page: Page, documents: Locator, prefix: string): Promise<void> {
  const active = page.getByRole('list', { name: 'Active filters', exact: true })
  await expect(active.getByRole('button')).toHaveCount(3)
  await active.getByRole('button', { name: 'Remove filter: Document type: Page', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Document type', exact: true })).toContainText('All types')
  await expect(documents.getByRole('link')).toHaveCount(2)
  await filter(page, 'Document type', 'Page')
  await active.getByRole('button', { name: `Remove filter: Search by title: ${prefix}`, exact: true }).click()
  await expect(page.getByRole('searchbox', { name: 'Search by title' })).toHaveValue('')
  await expect(page.getByRole('searchbox', { name: 'Search by title' })).toBeFocused()
  await expect(active.getByRole('button')).toHaveCount(2)
}

async function recoverInitialLoad(page: Page): Promise<void> {
  await page.route('**/api/admin/documents', async (route) => {
    await route.fulfill({ status: 503, json: { code: 'CONNECTION_FAILED' } })
  }, { times: 1 })
  await page.goto('/__fixture/login')
  await expect(page.getByRole('alert')).toContainText('Unable to load documents')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
}

test('documents retry, filter, recover trash and keep bilingual mobile UI', async ({ page }, info) => {
  await recoverInitialLoad(page)
  const prefix = `Admin browser ${crypto.randomUUID()}`
  const target = await seed(page, `${prefix} page target`, 'page')
  await seed(page, `${prefix} post target`, 'article')
  const published = await seed(page, `${prefix} published target`, 'article')
  await mutation(page, `/api/admin/documents/${published.documentId}/publish`, {
    expectedVersion: published.version,
    expectedLiveGeneration: published.liveGeneration,
    revisionId: published.headRevisionId,
  })
  await page.getByRole('button', { name: 'Refresh list', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search by title' }).fill(prefix)
  await filter(page, 'Document type', 'Page')
  await filter(page, 'Publication state', 'Draft')
  const documents = page.getByRole('list', { name: 'Documents', exact: true })
  await expect(documents.getByRole('link')).toHaveCount(1)
  await expect(documents).toContainText(`${prefix} page target`)
  await verifyActiveFilters(page, documents, prefix)
  await search(page, 'No document will match this title')
  await expect(page.getByText('No matching documents', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Document type', exact: true })).toContainText('All types')
  await expect(page.getByRole('searchbox', { name: 'Search by title' })).toHaveValue('')
  await expect(documents.getByRole('link', { name: `${prefix} published target`, exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('documents-en-desktop.png'), fullPage: true })
  await mutation(page, `/api/admin/documents/${target.documentId}`, {
    expectedVersion: target.version,
    expectedLiveGeneration: target.liveGeneration,
  }, 'DELETE')
  await filter(page, 'Publication state', 'Trash')
  await expect(documents).toContainText(`${prefix} page target`)
  await expect(documents.getByRole('link')).toHaveCount(0)
  const removed = documents.getByRole('listitem').filter({ hasText: `${prefix} page target` })
  await expect(removed.getByRole('button', { name: 'Restore draft', exact: true }))
    .toHaveAccessibleDescription(`${prefix} page target`)
  await removed.getByRole('button', { name: 'Restore draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Document restored as a draft')
  await expect(removed).toHaveCount(0)
  await filter(page, 'Publication state', 'Draft')
  await expect(documents.getByRole('link', { name: `${prefix} page target`, exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Language', exact: true }).click()
  await page.getByRole('option', { name: '简体中文', exact: true }).click()
  await expect(page.getByRole('heading', { name: '文档', exact: true })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: '按标题搜索' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: '发布状态', exact: true })).toContainText('草稿')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: '新建文章', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: '文档类型', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: '发布状态', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const width = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }))
  expect(width.body).toBeLessThanOrEqual(width.viewport)
  await page.screenshot({ path: info.outputPath('documents-zh-mobile.png'), fullPage: true })
})
