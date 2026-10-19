import type { Locator, Page } from '@playwright/test'
import type { Locale } from '~/tests/support/browser/locale'
import { openDocumentSchema } from '@/contracts/documents'
import { writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { labels, setLocale } from '~/tests/support/browser/locale'
import { expect, test } from '~/tests/support/browser/test'
import { historyFixture, setRecovery } from './preview-history-helpers'

const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page, context }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
  context.on('page', opened => opened.on('pageerror', error => errors.push(error.message)))
})
test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([])
})

async function previewContent(page: Page, locale: Locale): Promise<Locator> {
  const copy = labels[locale]
  const dialog = page.getByRole('dialog', { name: copy.dialog, exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('region', { name: copy.reader, exact: true }))
    .toContainText('The current unsaved paragraph, including 当前未保存的内容')
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await horizontalBounds(page, dialog)
  await horizontalBounds(page, dialog.getByRole('button', { name: copy.closePreview, exact: true }))
  await expect.poll(async () => await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return bounds.top >= 0 && bounds.bottom <= window.innerHeight
  })).toBe(true)
  return dialog
}

async function fromSettings(page: Page, locale: Locale, width: number, screenshot: string): Promise<void> {
  const copy = labels[locale]
  const settings = page.getByRole('button', { name: copy.settings, exact: true })
  if (width < 1100) {
    await settings.click()
  }
  await page.getByRole('tab', { name: copy.content, exact: true }).click()
  const trigger = page.getByRole('button', { name: copy.preview, exact: true })
  await expect(trigger).toHaveCount(1)
  await expect(page.getByRole('link', { name: /Preview saved revision|预览已保存修订/ })).toHaveCount(0)
  await trigger.click()
  const dialog = await previewContent(page, locale)
  await page.screenshot({ path: screenshot })
  await dialog.getByRole('button', { name: copy.closePreview, exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
  if (width < 1100) {
    const drawer = page.getByRole('dialog', { name: copy.settings, exact: true })
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: copy.close, exact: true }).click()
    await expect(drawer).not.toBeVisible()
  }
}

async function fromMore(page: Page, locale: Locale, width: number): Promise<void> {
  const copy = labels[locale]
  const trigger = page.getByRole('button', { name: copy.more, exact: true })
  await trigger.click()
  const panel = width <= 700 ? page.getByRole('dialog') : page.getByRole('menu')
  const role = width <= 700 ? 'button' : 'menuitem'
  const preview = panel.getByRole(role, { name: copy.preview, exact: true })
  await expect(preview).toHaveCount(1)
  await preview.click()
  const dialog = await previewContent(page, locale)
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
}

async function compactHistory(page: Page, locale: Locale, width: number): Promise<void> {
  const copy = labels[locale]
  if (width < 1100) {
    await page.getByRole('button', { name: copy.settings, exact: true }).click()
  }
  await page.getByRole('tab', { name: copy.publication, exact: true }).click()
  const history = page.getByRole('region', { name: copy.history, exact: true })
  await history.getByRole('button', { name: copy.history, exact: true }).click()
  const rows = history.locator('.revision-list li')
  await expect(rows).toHaveCount(3)
  await expect(history).not.toContainText(/[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}/i)
  const older = rows.filter({ has: page.getByText(`${copy.revision} 2`, { exact: true }) })
  const preview = older.getByRole('link', { name: copy.preview, exact: true })
  const restore = older.getByRole('button', { name: copy.restore, exact: true })
  await expect(preview.locator('svg')).toBeVisible()
  await expect(restore.locator('svg')).toBeVisible()
  await expect(restore).toBeEnabled()
  for (const action of [preview, restore]) {
    await horizontalBounds(page, action)
    if (width <= 700) {
      const bounds = await action.boundingBox()
      expect(bounds?.width).toBeGreaterThanOrEqual(44)
      expect(bounds?.height).toBeGreaterThanOrEqual(44)
    }
  }
  await expect(rows.filter({ has: page.getByText(`${copy.revision} 3`, { exact: true }) })
    .getByRole('button', { name: copy.restore, exact: true })).toBeDisabled()
}

for (const width of [
  320,
  390,
  1440,
]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`both preview entries show the unsaved draft without remounting at ${width}px in ${locale}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 740 })
      const ack = await writeDocument(page, fixture('The saved paragraph before editing'))
      await setLocale(page, locale)
      const body = page.getByLabel(labels[locale].body, { exact: true })
      const original = await body.elementHandle()
      let release: () => void = () => {}
      const autosaveGate = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route(`**/api/admin/documents/${ack.documentId}/revisions`, async (route) => {
        await autosaveGate
        await route.continue()
      })
      const publicWrites: string[] = []
      page.on('request', (request) => {
        if (request.method() !== 'GET' && /\/(?:publish|unpublish|restore)(?:\?|$)/.test(request.url())) {
          publicWrites.push(request.url())
        }
      })
      try {
        await body.fill('The current unsaved paragraph, including 当前未保存的内容')
        await fromSettings(page, locale, width, info.outputPath(`draft-preview-${width}-${locale}.png`))
        await fromMore(page, locale, width)
        expect(await original.evaluate(element => element.isConnected)).toBe(true)
        await expect(body).toContainText('The current unsaved paragraph, including 当前未保存的内容')
        const server = openDocumentSchema.parse(await (await page.request.get(
          `/api/admin/documents/${ack.documentId}`,
        )).json())
        expect(server.headRevisionId).toBe(ack.headRevisionId)
        expect(server.liveRevisionId).toBeNull()
        expect(publicWrites).toEqual([])
        await page.screenshot({ path: info.outputPath(`preview-return-${width}-${locale}.png`) })
      }
      finally {
        release()
        await original.dispose()
      }
      await expect(page.getByRole('status').filter({ hasText: new RegExp(`^${labels[locale].saved}$`) }))
        .toBeVisible({ timeout: 15000 })
    })
  }
}

for (const width of [320, 390]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`local recovery is readable, dismissible and recoverable at ${width}px in ${locale}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 740 })
      const ack = await writeDocument(page, fixture('The unchanged server paragraph'))
      await setLocale(page, locale)
      await setRecovery(page, ack)
      await page.reload()
      const copy = labels[locale]
      const notice = page.getByRole('region', { name: copy.recovery, exact: true })
      await expect(notice).toBeVisible()
      await expect(notice.getByRole('heading', { name: copy.recovery, exact: true })).toBeVisible()
      await expect(notice.locator('.editor-notice-icon[aria-hidden="true"] svg')).toBeVisible()
      await expect(notice.locator('time')).toHaveAttribute('datetime', /T/)
      await horizontalBounds(page, notice)
      for (const name of [copy.recover, copy.dismiss]) {
        const action = notice.getByRole('button', { name, exact: true })
        await expect(action.locator('svg[aria-hidden="true"]')).toBeVisible()
        await horizontalBounds(page, action)
      }
      await page.screenshot({ path: info.outputPath(`recovery-${width}-${locale}.png`) })
      await notice.getByRole('button', { name: copy.dismiss, exact: true }).click()
      await expect(notice).toHaveCount(0)
      await expect(page.getByLabel(copy.body, { exact: true })).toContainText('The unchanged server paragraph')
      await page.reload()
      await expect(notice).toBeVisible()
      await notice.getByRole('button', { name: copy.recover, exact: true }).click()
      await expect(page.getByLabel(copy.body, { exact: true }))
        .toContainText('A local recovery copy that was never sent to the server')
      await expect(notice).toHaveCount(0)
      const server = openDocumentSchema.parse(await (await page.request.get(
        `/api/admin/documents/${ack.documentId}`,
      )).json())
      expect(server.headRevisionId).toBe(ack.headRevisionId)
    })
  }
}

for (const width of [
  320,
  390,
  1440,
]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`history compares revisions with readable labels at ${width}px in ${locale}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 740 })
      const { first, latest, blockId } = await historyFixture(page)
      await setLocale(page, locale)
      await compactHistory(page, locale, width)
      await page.goto(`/admin/documents/${first.documentId}/history`)
      const copy = labels[locale]
      await expect(page.getByRole('heading', { name: copy.history, exact: true })).toBeVisible()
      const selection = page.locator('.history-selection')
      await expect(selection).toHaveAttribute('data-selected-revision', latest.headRevisionId)
      const selected = page.getByRole('combobox', { name: copy.selected, exact: true })
      if (width <= 700) {
        await selected.click()
        await horizontalBounds(page, page.getByRole('listbox'))
        await page.getByRole('option', { name: new RegExp(`^${copy.revision} 2(?:\\s|$)`) }).click()
      }
      else {
        await page.locator('.history-sidebar').getByRole('button', {
          name: new RegExp(`^${copy.revision} 2(?:\\s|$)`),
        }).click()
      }
      await expect(selection).toHaveAttribute('data-selected-revision', first.headRevisionId)
      const baseline = page.getByRole('combobox', { name: copy.baseline, exact: true })
      await baseline.click()
      await page.getByRole('option', { name: new RegExp(`^${copy.revision} 3(?:\\s|$)`) }).click()
      await expect(baseline).toContainText(`${copy.revision} 3`)
      const changed = page.locator('.diff-row[data-change="changed"]')
      await expect(changed).toHaveCount(1)
      await changed.locator('.diff-block-trigger').click()
      await expect(changed.locator('[data-side="before"]')).toContainText('The current paragraph after its edit')
      await expect(changed.locator('[data-side="after"]')).toContainText('The historical paragraph before its edit')
      const visibleText = await page.locator('.history-page').innerText()
      for (const id of [
        first.headRevisionId,
        latest.headRevisionId,
        blockId,
      ]) {
        expect(visibleText).not.toContain(id)
      }
      await horizontalBounds(page, selection)
      await horizontalBounds(page, changed)
      await page.screenshot({ path: info.outputPath(`history-comparison-${width}-${locale}.png`) })
      const [historical] = await Promise.all([
        page.waitForEvent('popup'),
        page.getByRole('link', { name: copy.historical, exact: true }).click(),
      ])
      await expect(historical.getByText('The historical paragraph before its edit', { exact: true })).toBeVisible()
      await expect(historical.getByText('The current paragraph after its edit', { exact: true })).toHaveCount(0)
      await historical.close()
    })
  }
}
