import type { Page } from '@playwright/test'
import type { Locale } from './preview-history-helpers'
import { expect, test } from '@playwright/test'
import {
  collapseLinkSelection,
  expectedLinkedDocument,
  expectSelectionRestored,
  linkCopy,
  linkFixture,
  linkPrefix,
  linkSaved,
  linkSelected,
  linkSuffix,
  linkUrl,
  openKeyboardLink,
  persistedLinkDocument,
  selectLinkPhrase,
} from './link-keyboard-helpers'
import { horizontalBounds } from './preview-history-helpers'

const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([])
})

for (const width of [320, 390]) {
  for (const locale of ['en', 'zh'] as const) {
    for (const modifier of ['Control', 'Meta'] as const) {
      const description = `closed options allow ${modifier}+K at ${width}px in ${locale} with cancel, save and Undo`
      test(description, async ({ page }, info) => {
        const body = await linkFixture(page, locale, width)
        const before = await persistedLinkDocument(page)
        await selectLinkPhrase(page, body)
        let url = await openKeyboardLink(page, locale, modifier)
        const dialog = page.getByRole('dialog', { name: linkCopy[locale].dialog, exact: true })
        await expect(dialog).toHaveCount(1)
        await expect(url).toBeFocused()
        await horizontalBounds(page, dialog)
        await url.fill('https://example.com/cancelled')
        await dialog.getByRole('button', { name: linkCopy[locale].cancel, exact: true }).click()
        await expect(dialog).not.toBeVisible()
        await expectSelectionRestored(page, body)
        const cancelled = await persistedLinkDocument(page)
        expect(cancelled.document).toEqual(before.document)
        expect(cancelled.headRevisionId).toBe(before.headRevisionId)
        url = await openKeyboardLink(page, locale, modifier)
        await page.keyboard.press('Escape')
        await expect(dialog).not.toBeVisible()
        await expectSelectionRestored(page, body)
        url = await openKeyboardLink(page, locale, modifier)
        await url.fill(linkUrl)
        await page.screenshot({ path: info.outputPath(`keyboard-link-dialog-${width}-${locale}-${modifier}.png`) })
        await dialog.getByRole('button', { name: linkCopy[locale].save, exact: true }).click()
        await expect(dialog).not.toBeVisible()
        await expect(body).toBeFocused()
        await linkSaved(page, locale)
        const expected = expectedLinkedDocument(before.document)
        expect((await persistedLinkDocument(page)).document).toEqual(expected)
        await expect(body.locator('a').filter({ hasText: linkSelected })).toHaveAttribute('href', linkUrl)
        await page.getByRole('button', { name: locale === 'en' ? 'Undo' : '撤销', exact: true }).click()
        await linkSaved(page, locale)
        expect((await persistedLinkDocument(page)).document).toEqual(before.document)
        await page.reload()
        await expect(body).toBeVisible()
        expect((await persistedLinkDocument(page)).document).toEqual(before.document)
        await expect(body.locator('a')).toHaveCount(0)
        await selectLinkPhrase(page, body)
        url = await openKeyboardLink(page, locale, modifier)
        await url.fill(linkUrl)
        await url.press('Enter')
        await expect(dialog).not.toBeVisible()
        await linkSaved(page, locale)
        await page.reload()
        await expect(body.locator('a').filter({ hasText: linkSelected })).toHaveAttribute('href', linkUrl)
        expect((await persistedLinkDocument(page)).document).toEqual(expected)
      })
    }
  }
}

for (const locale of ['en', 'zh'] as const) {
  test(`desktop link shortcut opens one editor at 1440px in ${locale}`, async ({ page }) => {
    const body = await linkFixture(page, locale, 1440)
    const before = await persistedLinkDocument(page)
    for (const modifier of ['Control', 'Meta'] as const) {
      await selectLinkPhrase(page, body)
      const url = await openKeyboardLink(page, locale, modifier)
      await expect(page.getByRole('textbox', { name: linkCopy[locale].url, exact: true })).toHaveCount(1)
      await expect(page.getByRole('dialog', { name: linkCopy[locale].dialog, exact: true })).toHaveCount(1)
      await url.fill(linkUrl)
      await url.press('Enter')
      await linkSaved(page, locale)
      expect((await persistedLinkDocument(page)).document).toEqual(expectedLinkedDocument(before.document))
      await page.getByRole('button', { name: locale === 'en' ? 'Undo' : '撤销', exact: true }).click()
      await linkSaved(page, locale)
      expect((await persistedLinkDocument(page)).document).toEqual(before.document)
    }
  })
}

for (const scenario of [
  { width: 320, locale: 'zh' },
  { width: 390, locale: 'en' },
] as const) {
  const description = `empty selection and composition reject Mod-K at ${scenario.width}px in ${scenario.locale}`
  test(description, async ({ page }) => {
    const { width, locale } = scenario
    const body = await linkFixture(page, locale, width)
    const before = await persistedLinkDocument(page)
    await collapseLinkSelection(page, body)
    await expectNoLinkCommand(page, locale)
    await selectLinkPhrase(page, body)
    await body.dispatchEvent('compositionstart')
    try {
      await expectNoLinkCommand(page, locale)
    }
    finally {
      await body.dispatchEvent('compositionend')
    }
    await linkSaved(page, locale)
    await expect(body).toHaveText(`${linkPrefix}${linkSelected}${linkSuffix}`)
    expect((await persistedLinkDocument(page)).document).toEqual(before.document)
    expect((await persistedLinkDocument(page)).headRevisionId).toBe(before.headRevisionId)
  })
}

async function expectNoLinkCommand(page: Page, locale: Locale): Promise<void> {
  for (const modifier of ['Control', 'Meta']) {
    await page.keyboard.press(`${modifier}+k`)
    await expect(page.getByRole('dialog', { name: linkCopy[locale].dialog, exact: true })).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: linkCopy[locale].url, exact: true })).toHaveCount(0)
  }
}

test('invalid link URLs keep the draft unchanged and a corrected bare domain saves safely', async ({ page }) => {
  const body = await linkFixture(page, 'zh', 390)
  const before = await persistedLinkDocument(page)
  await selectLinkPhrase(page, body)
  const url = await openKeyboardLink(page, 'zh', 'Meta')
  const dialog = page.getByRole('dialog', { name: linkCopy.zh.dialog, exact: true })
  for (const value of ['', 'https://exa mple.com']) {
    await url.fill(value)
    await dialog.getByRole('button', { name: linkCopy.zh.save, exact: true }).click()
    await expect(dialog).toBeVisible()
    await expect(url).toBeFocused()
    expect(await url.evaluate(element => element instanceof HTMLInputElement && element.validity.valid)).toBe(false)
    const unchanged = await persistedLinkDocument(page)
    expect(unchanged.document).toEqual(before.document)
    expect(unchanged.headRevisionId).toBe(before.headRevisionId)
    await expect(body.locator('a')).toHaveCount(0)
  }
  await url.fill('example.com')
  expect(await url.evaluate(element => element instanceof HTMLInputElement && element.validity.valid)).toBe(true)
  await dialog.getByRole('button', { name: linkCopy.zh.save, exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await linkSaved(page, 'zh')
  const expected = expectedLinkedDocument(before.document, 'https://example.com')
  expect((await persistedLinkDocument(page)).document).toEqual(expected)
  await page.reload()
  await expect(body.locator('a').filter({ hasText: linkSelected })).toHaveAttribute('href', 'https://example.com')
  expect((await persistedLinkDocument(page)).document).toEqual(expected)
})

test('pending operations make the mobile editor read-only and reject link shortcuts', async ({ page }) => {
  const body = await linkFixture(page, 'en', 390)
  const before = await persistedLinkDocument(page)
  let release: (() => void) | undefined
  let intercepted = false
  const hold = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/admin/documents/*/publish', async (route) => {
    intercepted = true
    await hold
    // Exercise the actual pending UI without sending a publication to the local server.
    await route.fulfill({ status: 503, json: { error: { code: 'QA_REQUEST_NOT_EXECUTED' } } })
  })
  try {
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect.poll(() => intercepted).toBe(true)
    await expect(body).toHaveAttribute('contenteditable', 'false')
    await selectLinkPhrase(page, body)
    await expectNoLinkCommand(page, 'en')
    const after = await persistedLinkDocument(page)
    expect(after.document).toEqual(before.document)
    expect(after.liveRevisionId).toBe(before.liveRevisionId)
    expect(after.headRevisionId).toBe(before.headRevisionId)
  }
  finally {
    release?.()
    await expect(body).toHaveAttribute('contenteditable', 'true')
    await page.unroute('**/api/admin/documents/*/publish')
  }
  await expect(body).toHaveText(`${linkPrefix}${linkSelected}${linkSuffix}`)
  await expect(page.getByRole('dialog', { name: linkCopy.en.dialog, exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: linkCopy.en.url, exact: true })).toHaveCount(0)
})
