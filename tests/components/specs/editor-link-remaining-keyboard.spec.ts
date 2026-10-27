import { horizontalBounds } from '~/tests/support/browser/layout'
import { formattingCopy, linkSelected, selectRange } from '../support/editor-formatting-fixtures'
import { linkSelection, openLinkWorkspace } from '../support/editor-link-remaining-fixtures'
import {
  collapseLinkSelection,
  expectNoLinkCommand,
} from '../support/editor-link-remaining-guards'
import {
  expectSelectionRestored,
  openShortcutLink,
  selectInlineRange,
  shortcutRound,
} from '../support/editor-link-remaining-ui'
import { expect, test } from '../support/test'

for (const { width, locale } of [
  { width: 320, locale: 'en' },
  { width: 320, locale: 'zh' },
  { width: 390, locale: 'en' },
  { width: 390, locale: 'zh' },
  { width: 1440, locale: 'en' },
  { width: 1440, locale: 'zh' },
] as const) {
  test(`Control+K and Meta+K open, cancel, save and Undo at ${width}px in ${locale}`, async ({ page }) => {
    const copy = formattingCopy[locale]
    const { api, body } = await openLinkWorkspace(page, { width, locale })
    try {
      for (const modifier of ['Control', 'Meta'] as const) {
        await selectRange(page, body, linkSelection, linkSelected)
        if ((width === 1440 && locale === 'en') || (width === 320 && locale === 'zh')) {
          await shortcutRound(page, api, body, { locale, modifier })
          continue
        }

        const url = await openShortcutLink(page, locale, modifier)
        await expect(url).toBeFocused()
        const dialog = page.getByRole('dialog', { name: copy.dialog, exact: true })
        await horizontalBounds(page, dialog)
        await dialog.getByRole('button', { name: copy.cancel, exact: true }).click()
        await expect(dialog).toHaveCount(0)
        await expectSelectionRestored(page, body)

        await selectRange(page, body, linkSelection, linkSelected)
        await openShortcutLink(page, locale, modifier)
        await page.keyboard.press('Escape')
        await expect(dialog).toHaveCount(0)
        await expectSelectionRestored(page, body)
      }
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

// Fixture composition drives the application lifecycle; the shortcuts are real
// browser input. This does not claim to inject an operating-system IME.
for (const { width, locale } of [
  { width: 1440, locale: 'en' },
  { width: 320, locale: 'zh' },
] as const) {
  test(
    `empty and composing selections suppress the shortcut at ${width}px in ${locale}`,
    async ({ page }) => {
      const { api, body } = await openLinkWorkspace(page, { width, locale })
      try {
        await collapseLinkSelection(page, body)
        await expectNoLinkCommand(page, { locale, body, api })

        await selectInlineRange(page, body, linkSelection, linkSelected)
        await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString()))
          .toBe(linkSelected)
        await body.dispatchEvent('compositionstart', { data: '汉' })
        try {
          await expectNoLinkCommand(page, { locale, body, api, requireCollapsed: false })
        }
        finally {
          await body.dispatchEvent('compositionend', { data: '' })
        }
        await expect(body).toHaveText('Before Selected link untouched suffix')
        expect(api.calls.filter(call => call.method === 'PUT')).toEqual([])
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    },
  )
}
