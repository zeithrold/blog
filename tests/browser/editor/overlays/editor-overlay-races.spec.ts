import { locateTable, publicationTables } from '~/tests/browser/publication/publication-locate-helpers'
import { deferOverlayClose } from '~/tests/support/browser/overlay-close-probe'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'

// Retained: the held close is released after the routed mobile menu navigates to
// Tags, so only the built application can prove the new route, its input focus
// and the unchanged URL. The desktop menu races run on the component surface.
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
