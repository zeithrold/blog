import { openDocumentSchema } from '@/contracts/documents'
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
