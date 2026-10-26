import { deferOverlayClose } from '~/tests/support/browser/overlay-close-probe'
import { expectPacketContent, revisionWrites } from '../support/editor-formatting-fixtures'
import {
  linkedContent,
  linkSelected,
  linkSelection,
  openLinkWorkspace,
} from '../support/editor-link-remaining-fixtures'
import {
  openShortcutLink,
  selectInlineRange,
} from '../support/editor-link-remaining-ui'
import { expect, test } from '../support/test'

// A close that is still waiting cannot take focus from the dialog reopened after it.
test('an old link dialog close cannot take focus from the reopened editor', async ({ page }) => {
  const { api, body } = await openLinkWorkspace(page, { width: 1440 })
  try {
    await selectInlineRange(page, body, linkSelection, linkSelected)
    await deferOverlayClose(page, '.editor-link-command')
    await openShortcutLink(page, 'en', 'Meta')
    const dialog = page.getByRole('dialog', { name: 'Create link', exact: true })
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect.poll(async () => await page.evaluate(() => window.overlayCloseProbe.count())).toBe(1)
    await selectInlineRange(page, body, linkSelection, linkSelected)
    const url = await openShortcutLink(page, 'en', 'Meta')
    await url.fill('/posts/kept-input')
    await page.evaluate(() => window.overlayCloseProbe.release())
    await expect(url).toBeFocused()
    await expect(url).toHaveValue('/posts/kept-input')
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(body).toBeFocused()
    expect(revisionWrites(api)).toEqual([])
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

// The compact drawer hands its selection to the link entry only once its close completes; a close
// that is still waiting must hold no dialog open and then deliver exactly that one editor.
test('a delayed formatting drawer close leaves the reopened link dialog alone at 390px', async ({ page }) => {
  const { api, body } = await openLinkWorkspace(page, { width: 390 })
  try {
    await selectInlineRange(page, body, linkSelection, linkSelected)
    await deferOverlayClose(page, '.formatting-options-drawer')
    await page.getByRole('button', { name: 'More formatting options', exact: true }).click()
    await page.getByRole('dialog', { name: 'Formatting options', exact: true })
      .getByRole('button', { name: 'Create link', exact: true })
      .click()
    await expect.poll(async () => await page.evaluate(() => window.overlayCloseProbe.count())).toBe(1)
    await expect(page.locator('.formatting-options-drawer')).toHaveCount(0)
    // The pending close holds the entry back instead of opening a second surface.
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.evaluate(() => window.overlayCloseProbe.release())
    const dialog = page.getByRole('dialog', { name: 'Create link', exact: true })
    const url = dialog.getByRole('textbox', { name: 'Edit URL', exact: true })
    await expect(url).toBeFocused()
    await url.fill('/posts/drawer-kept')
    await url.press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(body).toBeFocused()
    await expectPacketContent(api, linkedContent('/posts/drawer-kept'))
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
