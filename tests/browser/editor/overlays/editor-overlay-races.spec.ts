import { tableDocument } from '~/tests/browser/editor/tables/table-overlay-helpers'
import { locateTable, publicationTables } from '~/tests/browser/publication/publication-locate-helpers'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { deferOverlayClose } from '~/tests/support/browser/overlay-close-probe'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'

for (const reverse of [false, true]) {
  test(`old block-menu closes preserve the newer focus with reverse=${String(reverse)}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await writeDocument(page, tableDocument())
    await deferOverlayClose(page, '.editor-desktop-block-actions')
    const menu = page.locator('.editor-desktop-block-actions')
    const open = async (): Promise<void> => {
      const table = page.getByLabel('Document body', { exact: true }).locator('table')
      await table.getByText('First cell', { exact: true }).hover()
      await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
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
    expect(errors).toEqual([])
    await saved(page)
  })
}

test('a delayed mobile publication locator leaves the new route and input alone', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 900 })
  await publicationTables(page)
  await settingsTab(page, 'Publication')
  await deferOverlayClose(page, '.inspector-drawer')
  await locateTable(page.locator('.publication-summary'), 2).click()
  await expect.poll(async () => await page.evaluate(() => window.overlayCloseProbe.count())).toBe(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.locator('.workspace-navigation-mobile').click()
  await page.getByRole('menuitem', { name: 'Tags', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  const name = page.getByRole('textbox', { name: 'Name', exact: true })
  await name.fill('Keep typing on the destination')
  const path = page.url()
  await page.evaluate(() => window.overlayCloseProbe.release())
  await expect(name).toBeFocused()
  await expect(name).toHaveValue('Keep typing on the destination')
  expect(page.url()).toBe(path)
  expect(errors).toEqual([])
})
