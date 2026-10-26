import { expectPacketContent, formattingCopy, revisionWrites } from '../support/editor-formatting-fixtures'
import {
  linkedContent,
  linkSelected,
  linkSelection,
  linkText,
  openLinkWorkspace,
} from '../support/editor-link-remaining-fixtures'
import {
  collapseLinkSelection,
  expectNoLinkCommand,
  openShortcutLink,
  selectInlineRange,
  shortcutRound,
} from '../support/editor-link-remaining-ui'
import { expect, test } from '../support/test'

// The shortcut, its cancellation paths, its save and its Undo in one round, so the
// matrix keeps both product modifiers at every width and locale the retired cases ran.
for (const width of [
  320,
  390,
  1440,
]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`Control+K and Meta+K open, cancel, save and Undo at ${width}px in ${locale}`, async ({ page }) => {
      const { api, body } = await openLinkWorkspace(page, { locale, width })
      try {
        for (const modifier of ['Control', 'Meta'] as const) {
          await selectInlineRange(page, body, linkSelection, linkSelected)
          await shortcutRound(page, api, body, { locale, modifier })
        }
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
}

for (const { width, locale } of [
  { width: 1440, locale: 'en' },
  { width: 390, locale: 'en' },
  { width: 320, locale: 'zh' },
] as const) {
  test(`empty and composing selections suppress the shortcut at ${width}px in ${locale}`, async ({ page }) => {
    const { api, body } = await openLinkWorkspace(page, { locale, width })
    try {
      await collapseLinkSelection(page, body)
      await expectNoLinkCommand(page, locale)
      await selectInlineRange(page, body, linkSelection, linkSelected)
      await body.dispatchEvent('compositionstart')
      try {
        await expectNoLinkCommand(page, locale)
      }
      finally {
        await body.dispatchEvent('compositionend')
      }
      await expect(body).toHaveText(linkText)
      expect(revisionWrites(api)).toEqual([])
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('a corrected bare domain saves after refusals at 390px in zh', async ({ page }) => {
  const { api, body } = await openLinkWorkspace(page, { locale: 'zh', width: 390 })
  try {
    const copy = formattingCopy.zh
    await selectInlineRange(page, body, linkSelection, linkSelected)
    const url = await openShortcutLink(page, 'zh', 'Meta')
    const dialog = page.getByRole('dialog', { name: copy.dialog, exact: true })
    const save = dialog.getByRole('button', { name: copy.save, exact: true })
    for (const value of ['', 'https://exa mple.com']) {
      await url.fill(value)
      await save.click()
      await expect(dialog).toBeVisible()
      await expect(url).toBeFocused()
      await expect(url).toHaveAttribute('aria-invalid', 'true')
      await expect(body.locator('a')).toHaveCount(0)
      expect(revisionWrites(api)).toEqual([])
    }
    await url.fill('example.com')
    await save.click()
    await expect(dialog).toHaveCount(0)
    await expect(body).toBeFocused()
    await expectPacketContent(api, linkedContent('https://example.com'))
    await expect(body.locator('a').filter({ hasText: linkSelected }))
      .toHaveAttribute('href', 'https://example.com')
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
