import type { Locator, Page } from '@playwright/test'
import { fixture } from '~/tests/browser/editor/blocks/block-action-helpers'
import { tableDocument } from '~/tests/browser/editor/tables/table-overlay-helpers'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'

async function clearOfHeaders(menu: Locator): Promise<void> {
  await expect.poll(async () => await menu.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const header = document.querySelector('.workspace-header')?.getBoundingClientRect()
    const first = element.querySelector('button')?.getBoundingClientRect()
    const hit = first === undefined ? null : document.elementFromPoint(first.x + 16, first.y + first.height / 2)
    return bounds.top >= (header?.bottom ?? 0) + 4 && bounds.bottom <= innerHeight - 4 && element.contains(hit)
  })).toBe(true)
}

async function openMenu(page: Page): Promise<Locator> {
  await expect.poll(async () => await page.evaluate(() =>
    performance.getEntriesByName('cms-editor-ready').length)).toBeGreaterThan(0)
  const table = page.getByLabel('Document body', { exact: true }).locator('table')
  await table.evaluate((element) => {
    const header = document.querySelector('.workspace-header')?.getBoundingClientRect().bottom ?? 0
    const bounds = element.getBoundingClientRect()
    const target = innerHeight >= 600 ? (innerHeight - bounds.height) / 2 : header + 64
    window.scrollBy({ top: bounds.top - target, behavior: 'instant' })
  })
  await table.getByText('First cell', { exact: true }).hover()
  await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
  const menu = page.locator('.editor-desktop-block-actions')
  await expect(menu).toHaveCSS('opacity', '1')
  return menu
}

for (const height of [740, 400]) {
  test(`desktop menu avoids sticky headers through table and color changes at ${height}px`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width: 1440, height })
    const document = tableDocument()
    document.blocks.push(...fixture(10).blocks)
    await writeDocument(page, document)
    const menu = await openMenu(page)
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
    expect(errors).toEqual([])
  })
}
