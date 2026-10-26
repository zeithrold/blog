import type { Locator, Page } from '@playwright/test'
import { saved } from '~/tests/support/browser/document'
import { openBlockMenu, openTableWorkspace } from '../support/editor-overlay-fixtures'
import { expect, test } from '../support/test'

/**
 * The sticky header and the viewport edges bound the open menu. `elementFromPoint`
 * proves the first control is reachable rather than covered by the header the
 * menu has to avoid.
 */
async function clearOfHeaders(menu: Locator): Promise<void> {
  await expect.poll(async () => await menu.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const header = document.querySelector('.workspace-header')?.getBoundingClientRect()
    const first = element.querySelector('button')?.getBoundingClientRect()
    const hit = first === undefined ? null : document.elementFromPoint(first.x + 16, first.y + first.height / 2)
    return bounds.top >= (header?.bottom ?? 0) + 4 && bounds.bottom <= innerHeight - 4 && element.contains(hit)
  })).toBe(true)
}

/** Places the table so the menu has room above or below it inside the viewport. */
async function positionTable(page: Page): Promise<void> {
  const table = page.getByLabel('Document body', { exact: true }).locator('table')
  await table.evaluate((element) => {
    const header = document.querySelector('.workspace-header')?.getBoundingClientRect().bottom ?? 0
    const bounds = element.getBoundingClientRect()
    const target = innerHeight >= 600 ? (innerHeight - bounds.height) / 2 : header + 64
    window.scrollBy({ top: bounds.top - target, behavior: 'instant' })
  })
}

for (const height of [740, 400]) {
  test(`desktop menu avoids sticky headers through table and color changes at ${height}px`, async ({ page }, info) => {
    const { api } = await openTableWorkspace(page, {
      title: 'Overlay geometry',
      paragraphs: 10,
      height,
    })
    try {
      await positionTable(page)
      const menu = await openBlockMenu(page)
      await clearOfHeaders(menu)
      for (const name of ['Header row', 'Header column']) {
        await menu.getByRole('button', { name, exact: true }).click()
        await clearOfHeaders(menu)
      }
      await menu.getByRole('button', { name: 'Colors', exact: true }).click()
      await clearOfHeaders(menu)
      await menu.getByRole('button', { name: 'Back', exact: true }).click()
      await clearOfHeaders(menu)
      const scroll = await page.evaluate(() => window.scrollY)
      await page.evaluate(() => window.scrollBy(0, 16))
      await expect.poll(async () => await page.evaluate(() => window.scrollY)).toBe(scroll + 16)
      await clearOfHeaders(menu)
      await page.setViewportSize({ width: 1440, height: height === 740 ? 400 : 740 })
      await clearOfHeaders(menu)
      await page.screenshot({ path: info.outputPath(`desktop-menu-below-headers-${height}.png`) })
      await page.keyboard.press('Escape')
      await saved(page)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
