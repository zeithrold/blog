import { saved } from '~/tests/support/browser/document'
import { deferOverlayClose } from '~/tests/support/browser/overlay-close-probe'
import {
  desktopMenu,
  openBlockMenu,
  openTableWorkspace,
} from '../support/editor-overlay-fixtures'
import { expect, test } from '../support/test'

for (const reverse of [false, true]) {
  test(`old block-menu closes preserve the newer focus with reverse=${String(reverse)}`, async ({ page }) => {
    const { api } = await openTableWorkspace(page, { title: 'Overlay races' })
    try {
      await deferOverlayClose(page, '.editor-desktop-block-actions')
      const menu = desktopMenu(page)
      const open = async (): Promise<void> => {
        await openBlockMenu(page)
        await expect(menu.getByRole('button', { name: 'Delete', exact: true })).toBeFocused()
      }
      await open()
      await page.keyboard.press('Escape')
      await expect.poll(async () => await page.evaluate(() => window.overlayCloseProbe.count())).toBe(1)
      await open()
      if (reverse) {
        await page.keyboard.press('Escape')
        await expect.poll(async () => await page.evaluate(() => window.overlayCloseProbe.count())).toBe(2)
        const title = page.getByRole('textbox', { name: 'Title', exact: true })
        await title.click()
        await page.evaluate(() => window.overlayCloseProbe.release(true))
        await expect(title).toBeFocused()
      }
      else {
        await page.evaluate(() => window.overlayCloseProbe.release())
        await expect(menu).toBeVisible()
        await expect(menu.getByRole('button', { name: 'Delete', exact: true })).toBeFocused()
        await page.keyboard.press('Escape')
        await expect(menu).toHaveCount(0)
        await expect(page.getByLabel('Document body', { exact: true })).toBeFocused()
      }
      await saved(page)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
