import { assertAccessible } from '~/tests/support/browser/accessibility'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'
import { openLinkEntry } from './link-entry-helpers'
import {
  expectedLinkedDocument,
  linkCopy,
  linkFixture,
  linkSaved,
  persistedLinkDocument,
  selectLinkPhrase,
} from './link-keyboard-helpers'

const entry = 'keyboard' as const
const { width, locale } = { width: 1440, locale: 'en' } as const

// The one retained link persistence representative: it proves the normalized destination reaches
// the Worker and that undo restores the stored document.
test(`links validate and normalize destinations at ${width}px in ${locale}`, async ({ page }, info) => {
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
    await expect(dialog.getByRole('alert')).toContainText('Enter a valid')
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
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
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
