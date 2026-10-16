import type { Locator, Page } from '@playwright/test'
import { openDocumentSchema } from '@/content/contracts'
import { emptyDocument } from '@/content/document'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'

type Locale = 'en' | 'zh'
const labels = {
  en: {
    language: 'English',
    back: 'All documents',
    compactBack: 'Back',
    publish: 'Publish',
    more: 'More document actions',
    sync: 'Sync draft now',
    close: 'Close',
    remove: 'Delete document',
    cancel: 'Cancel',
  },
  zh: {
    language: '简体中文',
    back: '所有文档',
    compactBack: '返回',
    publish: '发布',
    more: '更多文档操作',
    sync: '立即同步草稿',
    close: '关闭',
    remove: '删除文档',
    cancel: '取消',
  },
} as const

async function language(page: Page, locale: Locale): Promise<void> {
  await page.getByRole('combobox', { name: /^(Language|语言)$/ }).click()
  await page.getByRole('option', { name: labels[locale].language, exact: true }).click()
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

for (const width of [320, 390]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`mobile actions fit two header rows at ${width}px in ${locale} and return focus after dialogs`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 740 })
      await writeDocument(page, documentWithBody('A compact mobile writing workspace'))
      if (locale === 'zh') {
        await language(page, locale)
      }
      const text = labels[locale]
      const header = page.locator('.workspace-header')
      const back = header.getByRole('link', { name: text.back, exact: true })
      const publish = header.getByRole('button', { name: text.publish, exact: true })
      const more = header.getByRole('button', { name: text.more, exact: true })
      await expect.poll(async () => await back.innerText()).toBe(text.compactBack)
      await expect(publish).toBeVisible()
      await expect(header.getByRole('button', { name: /^(Save|保存)$/ })).toHaveCount(0)
      const positions = await Promise.all([
        box(back),
        box(publish),
        box(more),
        box(header),
      ])
      const [backBox, publishBox, moreBox, headerBox] = positions
      const center = (bounds: { top: number, height: number }): number => bounds.top + bounds.height / 2
      expect(Math.abs(center(backBox) - center(publishBox))).toBeLessThanOrEqual(2)
      expect(Math.abs(center(moreBox) - center(publishBox))).toBeLessThanOrEqual(2)
      expect(publishBox.height).toBeGreaterThanOrEqual(44)
      expect(moreBox.height).toBeGreaterThanOrEqual(44)
      expect(headerBox.height).toBeLessThanOrEqual(110)
      const statusBox = await box(header.locator('.workspace-status'))
      expect(statusBox.top).toBeGreaterThanOrEqual(publishBox.bottom)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath(`mobile-editor-header-${locale}-${width}.png`) })

      await more.click()
      const drawer = page.getByRole('dialog', { name: text.more, exact: true })
      await expect(drawer).toBeVisible()
      await expect(drawer.locator('[data-slot="drawer-handle"]')).toBeVisible()
      await expect(drawer).toContainText(locale === 'zh' ? /自动保存/ : /automatically/)
      await expect(drawer.getByRole('button', { name: text.sync, exact: true })).toBeDisabled()
      await expect(page.getByRole('menu')).toHaveCount(0)
      await page.screenshot({ path: info.outputPath(`mobile-editor-actions-${locale}-${width}.png`) })
      await drawer.getByRole('button', { name: text.close, exact: true }).click()
      await expect(drawer).toHaveCount(0)
      await expect(more).toBeFocused()
      await more.click()
      await page.keyboard.press('Escape')
      await expect(drawer).toHaveCount(0)
      await expect(more).toBeFocused()

      await more.click()
      await drawer.getByRole('button', { name: text.remove, exact: true }).click()
      await expect(drawer).toHaveCount(0)
      const confirmation = page.getByRole('dialog')
      await expect(confirmation).toBeVisible()
      await confirmation.getByRole('button', { name: text.cancel, exact: true }).click()
      await expect(confirmation).toHaveCount(0)
      await expect(more).toBeFocused()
      await expect(page.getByLabel('Document body', { exact: true }))
        .toContainText('A compact mobile writing workspace')
    })
  }
}

test('mobile preview closes the action drawer and resizing never reopens a dismissed panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await writeDocument(page, documentWithBody('A current draft opened from mobile actions'))
  const more = page.getByRole('button', { name: 'More document actions', exact: true })
  const drawer = page.getByRole('dialog', { name: 'More document actions', exact: true })
  await more.click()
  await drawer.getByRole('button', { name: 'Preview', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Draft preview', exact: true })
  await expect(drawer).toHaveCount(0)
  await expect(preview.getByRole('heading', { name: 'Mobile document actions', exact: true })).toBeVisible()
  await expect(preview).toContainText('A current draft opened from mobile actions')
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
  await expect(preview).toHaveCount(0)
  await expect(more).toBeFocused()
  await more.click()
  await expect(drawer).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(drawer).toHaveCount(0)
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(drawer).toHaveCount(0)
  await more.click()
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(more).toBeFocused()
})

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
