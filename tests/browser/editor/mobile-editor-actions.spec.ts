import type { Locator, Page } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { openDocumentSchema } from '@/contracts/documents'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'

/**
 * The stored half of the compact document actions. Draft and publication
 * persistence, the live revision and the public page need the real Worker and
 * its own D1, so these cases stay E2E. Their chrome - header rows, the action
 * drawer, dialogs and focus return - is proved against the same production
 * components in `tests/components/specs/editor-chrome-mobile-actions.spec.ts`,
 * and `tests/contracts/editor-chrome-migrations.ts` records which assertion
 * lives where.
 */

type Locale = 'en' | 'zh'
const languages: Readonly<Record<Locale, string>> = {
  en: 'English',
  zh: '简体中文',
}

async function language(page: Page, locale: Locale): Promise<void> {
  await page.getByRole('combobox', { name: /^(Language|语言)$/ }).click()
  await page.getByRole('option', { name: languages[locale], exact: true }).click()
  await expect(page.getByRole('option')).toHaveCount(0)
}

function documentWithBody(body: string): ReturnType<typeof emptyDocument> {
  const document = emptyDocument()
  document.meta.title = 'Mobile document actions'
  document.meta.slug = `mobile-actions-${crypto.randomUUID()}`
  const paragraph = document.blocks[0]
  if (paragraph === undefined) {
    throw new Error('Missing initial paragraph')
  }
  paragraph.content = [
    { type: 'text', text: body, styles: {} },
  ]
  return document
}

async function openServerDocument(page: Page, documentId: string): Promise<
  ReturnType<typeof openDocumentSchema.parse>
> {
  return openDocumentSchema.parse(await (await page.request.get(`/api/admin/documents/${documentId}`)).json())
}

async function box(locator: Locator): Promise<{ top: number, bottom: number, height: number }> {
  return await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return { top: bounds.top, bottom: bounds.bottom, height: bounds.height }
  })
}

test('mobile sync writes pending changes privately and autosave remains independent', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const ack = await writeDocument(page, documentWithBody('The initial saved body'))
  const body = page.getByLabel('Document body', { exact: true })
  await body.fill('The immediately synchronized private draft')
  await expect(page.getByRole('status').filter({ hasText: /^Unsaved changes$/ })).toBeVisible()
  await page.getByRole('button', { name: 'More document actions', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'More document actions', exact: true })
  const sync = drawer.getByRole('button', { name: 'Sync draft now', exact: true })
  await expect(sync).toBeEnabled()
  const revision = page.waitForResponse(response =>
    response.url().endsWith(`/api/admin/documents/${ack.documentId}/revisions`)
    && response.request().method() === 'PUT',
  )
  await sync.click()
  expect((await revision).ok()).toBe(true)
  await saved(page)
  const synchronized = await openServerDocument(page, ack.documentId)
  expect(synchronized.headRevisionId).not.toBe(ack.headRevisionId)
  expect(synchronized.liveRevisionId).toBeNull()
  expect(JSON.stringify(synchronized.document)).toContain('The immediately synchronized private draft')
  expect((await page.request.get(`/posts/${synchronized.document.meta.slug}`)).status()).toBe(404)
  await expect(drawer).toHaveCount(0)
  await page.getByRole('button', { name: 'More document actions', exact: true }).click()
  await expect(sync).toBeDisabled()
  await drawer.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(drawer).toHaveCount(0)

  await body.fill('The next edit is saved automatically')
  await expect(page.getByRole('status').filter({ hasText: /^Unsaved changes$/ })).toBeVisible()
  await saved(page)
  const automatic = await openServerDocument(page, ack.documentId)
  expect(automatic.headRevisionId).not.toBe(synchronized.headRevisionId)
  expect(automatic.liveRevisionId).toBeNull()
  expect(JSON.stringify(automatic.document)).toContain('The next edit is saved automatically')
})

test('mobile publish drains pending edits and exposes the live document and unpublish through the drawer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  const ack = await writeDocument(page, documentWithBody('The initial unpublished body'))
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes(`/api/admin/documents/${ack.documentId}/`)
      && ['PUT', 'POST'].includes(request.method())) {
      requests.push(new URL(request.url()).pathname.split('/').at(-1) ?? '')
    }
  })
  await page.getByLabel('Document body', { exact: true }).fill('Pending content included in the first publication')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  expect(requests).toContain('revisions')
  expect(requests.indexOf('revisions')).toBeLessThan(requests.indexOf('publish'))
  const live = await openServerDocument(page, ack.documentId)
  expect(live.headRevisionId).not.toBe(ack.headRevisionId)
  expect(live.liveRevisionId).toBe(live.headRevisionId)
  expect(live.livePath).not.toBeNull()
  const response = await page.request.get(live.livePath ?? '')
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain('Pending content included in the first publication')
  const header = page.locator('.workspace-header')
  const update = header.getByRole('button', { name: 'Update publication', exact: true })
  await expect.poll(async () => await update.innerText()).toBe('Update')
  await expect(header.getByRole('link', { name: 'View live document', exact: true })).toHaveCount(0)
  expect((await box(header)).height).toBeLessThanOrEqual(110)
  const more = header.getByRole('button', { name: 'More document actions', exact: true })
  await more.click()
  const drawer = page.getByRole('dialog', { name: 'More document actions', exact: true })
  await expect(drawer.getByRole('link', { name: 'View live document', exact: true }))
    .toHaveAttribute('href', live.livePath ?? '')
  await drawer.getByRole('button', { name: 'Unpublish', exact: true }).click()
  await expect(drawer).toHaveCount(0)
  const confirmation = page.getByRole('dialog', { name: 'Unpublish this document?', exact: true })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  await expect(more).toBeFocused()
  expect((await page.request.get(live.livePath ?? '')).status()).toBe(200)
  await language(page, 'zh')
  await expect.poll(async () => await header.getByRole('button', { name: '更新发布', exact: true }).innerText())
    .toBe('更新')
})

test('mobile sync remains disabled when a draft requires conflict resolution', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const ack = await writeDocument(page, documentWithBody('The conflicting server baseline'))
  await page.route(`**/api/admin/documents/${ack.documentId}/revisions`, async (route) => {
    await route.fulfill({ status: 409, json: { code: 'EDIT_CONFLICT' } })
  })
  await page.getByLabel('Document body', { exact: true }).fill('Keep this local conflicting draft')
  await expect(page.getByText('Conflict — draft preserved', { exact: true })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'More document actions', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'More document actions', exact: true })
  await expect(drawer.getByRole('button', { name: 'Sync draft now', exact: true })).toBeDisabled()
  await drawer.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByLabel('Document body', { exact: true })).toContainText('Keep this local conflicting draft')
  expect((await openServerDocument(page, ack.documentId)).headRevisionId).toBe(ack.headRevisionId)
})
