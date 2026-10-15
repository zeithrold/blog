import { expect, test } from '@playwright/test'
import { assertAccessible } from './accessibility'
import { openLinkEntry } from './link-entry-helpers'
import {
  expectedLinkedDocument,
  linkCopy,
  linkFixture,
  linkSaved,
  persistedLinkDocument,
  selectLinkPhrase,
} from './link-keyboard-helpers'
import { horizontalBounds } from './preview-history-helpers'

for (const entry of ['keyboard', 'toolbar'] as const) {
  for (const screen of [
    { width: 1440, locale: 'en' },
    { width: 320, locale: 'zh' },
  ] as const) {
    const name = `${entry} links validate and normalize destinations at ${screen.width}px in ${screen.locale}`
    test(name, async ({ page }, info) => {
      const { width, locale } = screen
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      const body = await linkFixture(page, locale, width)
      const before = await persistedLinkDocument(page)
      await selectLinkPhrase(page, body)
      let url = await openLinkEntry(page, width, locale, entry)
      const dialog = page.getByRole('dialog', { name: linkCopy[locale].dialog, exact: true })
      const save = dialog.getByRole('button', { name: linkCopy[locale].save, exact: true })
      for (const value of [
        '',
        'https://exa mple.com',
        'ftp://example.com',
        '//elsewhere.example/path',
        'https://user:password@example.com',
        `example.com/${'x'.repeat(2036)}`,
      ]) {
        await url.fill(value)
        await save.click()
        await expect(dialog).toBeVisible()
        await expect(url).toBeFocused()
        await expect(url).toHaveAttribute('aria-invalid', 'true')
        await expect(dialog.getByRole('alert')).toContainText(locale === 'en' ? 'Enter a valid' : '请输入有效')
        await expect(body.locator('a')).toHaveCount(0)
        expect((await persistedLinkDocument(page)).headRevisionId).toBe(before.headRevisionId)
      }
      await horizontalBounds(page, dialog)
      await assertAccessible(page, info, { label: `link-validation-${entry}-${locale}` })
      await page.screenshot({ path: info.outputPath(`link-validation-${entry}-${locale}.png`) })
      for (const [value, expected] of [
        ['/posts/entry#part', '/posts/entry#part'],
        ['HTTPS://example.com/Case', 'https://example.com/Case'],
        ['httpbin.org/get', 'https://httpbin.org/get'],
        ['#section', '#section'],
      ]) {
        await url.fill(value ?? '')
        await save.click()
        await expect(dialog).toHaveCount(0)
        await expect(body).toBeFocused()
        await linkSaved(page, locale)
        expect((await persistedLinkDocument(page)).document)
          .toEqual(expectedLinkedDocument(before.document, expected))
        await page.getByRole('button', { name: locale === 'en' ? 'Undo' : '撤销', exact: true }).click()
        await linkSaved(page, locale)
        expect((await persistedLinkDocument(page)).document).toEqual(before.document)
        await selectLinkPhrase(page, body)
        url = await openLinkEntry(page, width, locale, entry)
      }
      await dialog.getByRole('button', { name: linkCopy[locale].cancel, exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect(body).toBeFocused()
      expect(errors).toEqual([])
    })
  }
}
