import { expect, test } from '~/tests/support/browser/test'
import {
  expectedLinkedDocument,
  linkFixture,
  linkSaved,
  openKeyboardLink,
  persistedLinkDocument,
  selectLinkPhrase,
} from './link-keyboard-helpers'

for (const width of [1440, 390]) {
  test(`link entry rejects invalid addresses before changing the draft at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const body = await linkFixture(page, 'en', width)
    const before = await persistedLinkDocument(page)
    await selectLinkPhrase(page, body)
    if (width === 390) {
      await page.getByRole('button', { name: 'More formatting options', exact: true }).click()
      await page.getByRole('dialog', { name: 'Formatting options', exact: true })
        .getByRole('button', { name: 'Create link', exact: true })
        .click()
    }
    else { await openKeyboardLink(page, 'en', 'Meta') }
    const url = page.getByRole('textbox', { name: 'Edit URL', exact: true })
    await url.fill('https://exa mple.com')
    await url.press('Enter')
    await expect(url).toBeVisible()
    await expect(url).toBeFocused()
    expect(await url.evaluate(element => element instanceof HTMLInputElement && element.validity.valid)).toBe(false)
    const rejected = await persistedLinkDocument(page)
    expect(rejected.document).toEqual(before.document)
    expect(rejected.headRevisionId).toBe(before.headRevisionId)
    await url.fill('httpbin.org/get')
    await url.press('Enter')
    await linkSaved(page, 'en')
    expect((await persistedLinkDocument(page)).document)
      .toEqual(expectedLinkedDocument(before.document, 'https://httpbin.org/get'))
    expect(errors).toEqual([])
  })
}
