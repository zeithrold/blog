import { deferOverlayClose } from '~/tests/support/browser/overlay-close-probe'
import {
  expectPacketContent,
  formattingCopy,
  linkSelected,
  selectRange,
} from '../support/editor-formatting-fixtures'
import {
  linkedContent,
  linkSelection,
  openLinkWorkspace,
} from '../support/editor-link-remaining-fixtures'
import {
  openShortcutLink,
} from '../support/editor-link-remaining-ui'
import { expect, test } from '../support/test'

// A close that is still waiting cannot take focus from the dialog reopened after it.
test('an old link dialog close cannot take focus from the reopened editor', async ({ page }) => {
  const { api, body } = await openLinkWorkspace(page, { width: 1440 })
  try {
    await selectRange(page, body, linkSelection, linkSelected)
    await deferOverlayClose(page, '.editor-link-command')
    await openShortcutLink(page, 'en', 'Meta')
    const dialog = page.getByRole('dialog', { name: 'Create link', exact: true })
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect.poll(async () => await page.evaluate(() => window.overlayCloseProbe.count())).toBe(1)
    await selectRange(page, body, linkSelection, linkSelected)
    const url = await openShortcutLink(page, 'en', 'Meta')
    await page.evaluate(() => window.overlayCloseProbe.release())
    await expect(url).toBeFocused()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(body).toBeFocused()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

// Keep the historical key while completing a real save after the delayed drawer handoff.
test('a delayed formatting drawer close leaves the reopened link dialog alone at 390px', async ({ page }) => {
  const { api, body } = await openLinkWorkspace(page, { width: 390 })
  const destination = '/posts/delayed-drawer-handoff'
  try {
    await selectRange(page, body, linkSelection, linkSelected)
    await deferOverlayClose(page, '.formatting-options-drawer')
    await page.getByRole('button', { name: 'More formatting options', exact: true }).click()
    await page.getByRole('dialog', { name: 'Formatting options', exact: true })
      .getByRole('button', { name: 'Create link', exact: true })
      .click()
    await expect.poll(async () => await page.evaluate(() => window.overlayCloseProbe.count())).toBe(1)
    await page.evaluate(() => window.overlayCloseProbe.release())
    const dialog = page.getByRole('dialog', {
      name: formattingCopy.en.dialog,
      exact: true,
    })
    const url = dialog.getByRole('textbox', { name: formattingCopy.en.url, exact: true })
    await expect(url).toBeFocused()
    await url.pressSequentially(destination)
    await dialog.getByRole('button', { name: formattingCopy.en.save, exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(body).toBeFocused()
    await expect(body).toHaveText('Before Selected link untouched suffix')
    await expect(body.locator('a')).toHaveCount(1)
    await expect(body.locator('a')).toHaveText(linkSelected)
    await expect(body.locator('a')).toHaveAttribute('href', destination)
    await api.expectServed()
    await expectPacketContent(api, linkedContent(destination))
  }
  finally {
    await api.dispose()
  }
})
