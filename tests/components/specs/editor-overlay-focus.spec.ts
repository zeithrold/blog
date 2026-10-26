import type { Page } from '@playwright/test'
import { saved } from '~/tests/support/browser/document'
import { selectRange } from '../support/editor-formatting-fixtures'
import {
  desktopMenu,
  expectPacketMeta,
  openBlockMenu,
  openSelectionWorkspace,
  openTableWorkspace,
} from '../support/editor-overlay-fixtures'
import { expect, test } from '../support/test'

const phrase = 'Selected phrase'
const selected = phrase.slice(0, 8)

for (const surface of ['block', 'colors'] as const) {
  for (const target of ['title', 'settings'] as const) {
    test(`desktop ${surface} menu outside click keeps the ${target} focus`, async ({ page }, info) => {
      const { api } = surface === 'block'
        ? await openTableWorkspace(page, { title: 'Overlay focus' })
        : await openSelectionWorkspace(page, phrase)
      try {
        await openMenu(page, surface)
        const menu = surface === 'block'
          ? desktopMenu(page)
          : page.getByRole('dialog', { name: 'Colors', exact: true })
        await expect(menu).toBeVisible()
        const field = page.getByRole('textbox', {
          name: target === 'title' ? 'Title' : 'Slug',
          exact: true,
        })
        await field.click()
        await expect(menu).toHaveCount(0)
        await expect(field).toBeFocused()
        const addition = target === 'title' ? ' appended' : '-edited'
        // The outside click also moved the caret, so the typed text replaces
        // nothing and lands exactly where the pointer left it.
        const expected = await field.evaluate((element: HTMLInputElement, text) =>
          element.value.slice(0, element.selectionStart ?? 0) + text
          + element.value.slice(element.selectionEnd ?? 0), addition)
        await page.keyboard.type(addition)
        await expect(field).toHaveValue(expected)
        await saved(page)
        if (surface === 'block' && target === 'title') {
          await page.screenshot({ path: info.outputPath('outside-click-title-focus.png') })
        }
        // The write carries the edited field; persisted state stays with E2E.
        await expectPacketMeta(api, target === 'title' ? { title: expected } : { slug: expected })
        await api.expectServed()
      }
      finally {
        await api.dispose()
      }
    })
  }
}

/** Opens the menu the way an author reaches it from the table or the selection toolbar. */
async function openMenu(page: Page, surface: 'block' | 'colors'): Promise<void> {
  if (surface === 'block') {
    await openBlockMenu(page)
    return
  }
  const body = page.getByLabel('Document body', { exact: true })
  await selectRange(page, body, { start: 0, end: selected.length }, selected)
  await page.getByRole('toolbar', { name: 'Formatting', exact: true })
    .getByRole('button', { name: 'Colors', exact: true })
    .click()
}
