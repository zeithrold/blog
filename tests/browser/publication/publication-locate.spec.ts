import { openDocumentSchema } from '@/contracts/documents'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { saved } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'
import { expectCaptionTarget, labels, locateTable, publicationTables, saveCaption } from './publication-locate-helpers'

for (const width of [1440, 320]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`publication preserves reasons and locates each table at ${width}px in ${locale}`, async ({ page }, info) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.setViewportSize({ width, height: 900 })
      const original = await publicationTables(page, locale)
      const text = labels[locale]
      await page.getByRole('button', { name: text.publish, exact: true }).click()
      const notice = page.getByRole('region', { name: text.error, exact: true })
      await expect(notice).toBeVisible()
      const title = page.getByRole('textbox', { name: text.title, exact: true })
      await title.fill('Unrelated title correction')
      await expect(notice).toBeVisible()
      await expect(title).toBeFocused()
      await expect(locateTable(notice, 2)).toBeVisible()
      const inlineLink = locateTable(notice, 2)
      await expect(inlineLink).toHaveAttribute('data-variant', 'link')
      await expect(inlineLink).toHaveCSS('display', /^inline(?:-block)?$/)
      await expect(inlineLink).toHaveCSS('text-decoration-line', 'underline')
      await expect(inlineLink).toHaveCSS('padding-top', '0px')
      await expect(inlineLink.locator('svg')).toHaveCount(0)
      await page.screenshot({ path: info.outputPath(`publication-locate-error-${width}-${locale}.png`) })
      await inlineLink.focus()
      await inlineLink.press('Enter')
      await expectCaptionTarget(page, original.first)
      await saveCaption(page, original.first, 'First table caption', locale)
      await expect(notice).toBeVisible()
      await expect(locateTable(notice, 1)).toHaveCount(1)
      await locateTable(notice, 1).click()
      await expectCaptionTarget(page, original.second)
      await saveCaption(page, original.second, 'Second table caption', locale)
      await expect(notice).toHaveCount(0)
      await savedInLocale(page, text.saved)
      const current = openDocumentSchema.parse(
        await (await page.request.get(`/api/admin/documents/${original.initial.documentId}`)).json(),
      )
      expect(current.document.tableAccessibility).toMatchObject({
        [original.first]: { caption: 'First table caption' },
        [original.second]: { caption: 'Second table caption' },
      })
      const publishing = page.waitForResponse(response => response.url().endsWith('/publish')
        && response.request().method() === 'POST')
      await page.getByRole('button', { name: text.publish, exact: true }).click()
      expect((await publishing).status()).toBe(200)
      const publicPage = await page.request.get(`/posts/${original.document.meta.slug}`)
      expect(publicPage.ok()).toBe(true)
      const publicHTML = await publicPage.text()
      expect(publicHTML).toContain('First table caption')
      expect(publicHTML).toContain('Second table caption')
      expect(errors).toEqual([])
      await page.screenshot({ path: info.outputPath(`publication-corrected-${width}-${locale}.png`) })
    })
  }
}

async function savedInLocale(page: import('@playwright/test').Page, name: string): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: new RegExp(`^${name}$`) })).toBeVisible({ timeout: 15000 })
}

for (const width of [1440, 320]) {
  test(`failed autosave retains publication reasons and typing focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await publicationTables(page)
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    const notice = page.getByRole('region', { name: 'Publication checks failed', exact: true })
    await expect(locateTable(notice, 2)).toBeVisible()
    let failed = false
    await page.route('**/revisions', async (route) => {
      if (route.request().method() === 'PUT' && !failed) {
        failed = true
        await route.fulfill({ status: 503, json: { code: 'CONNECTION_FAILED' } })
      }
      else { await route.continue() }
    })
    const title = page.getByRole('textbox', { name: 'Title', exact: true })
    await title.fill('Typing through a temporary save failure')
    const saveError = page.getByRole('region', { name: 'Could not complete this action', exact: true })
    await expect(saveError).toContainText('Connection failed.')
    await expect(locateTable(notice, 2)).toBeVisible()
    await expect(title).toBeFocused()
    await savedInLocale(page, 'Saved')
    await expect(saveError).toHaveCount(0)
    await expect(locateTable(notice, 2)).toBeVisible()
    await expect(title).toBeFocused()
  })
}

for (const width of [1440, 320]) {
  test(`publication summary cycles current table order and returns focus at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const original = await publicationTables(page)
    const summary = page.locator('.publication-summary')
    await settingsTab(page, 'Publication')
    await locateTable(summary, 2).click()
    await expectCaptionTarget(page, original.first)
    if (width === 320) {
      await expect(page.getByRole('dialog', { name: 'Document settings', exact: true })).toHaveCount(0)
    }
    await settingsTab(page, 'Publication')
    await locateTable(summary, 2).click()
    await expectCaptionTarget(page, original.second)
    // Move the second table above the first. The incremental node index keeps
    // its old insertion order, so the next lookup must use the actual document.
    await page.getByRole('button', { name: 'Move block up', exact: true }).click()
    await saved(page)
    await settingsTab(page, 'Publication')
    await locateTable(summary, 2).click()
    await expectCaptionTarget(page, original.first)
    await settingsTab(page, 'Publication')
    await assertAccessible(page, info, { label: `publication-locate-${width}` })
    await page.screenshot({ path: info.outputPath(`publication-locate-${width}.png`) })
  })
}
