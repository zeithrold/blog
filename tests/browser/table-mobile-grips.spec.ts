import { expect, test } from '@playwright/test'
import { withinViewport } from './block-action-helpers'
import { saved, writeDocument } from './helpers'
import {
  alignedBlockControls,
  bounds,
  checkBars,
  documentTable,
  persistedTable,
  tableDocument,
} from './table-overlay-helpers'

test.use({ hasTouch: true })

for (const width of [
  320,
  390,
  486,
]) {
  test(`mobile table grips follow the touched cell at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const acknowledgement = await writeDocument(page, tableDocument(3, 3, 100))
    const table = documentTable(page)
    await table.locator('td, th').first().tap()
    await checkBars(page, table)
    const group = page.locator('.editor-side[data-slot="button-group"]')
    await expect(group).toBeVisible()
    await alignedBlockControls(page, group)
    await expect(page.locator('[data-table-active-handle="true"]')).toHaveCount(2)
    const columnGrip = await bounds(page.getByRole('button', { name: 'Column 1 options', exact: true }).locator('span'))
    const tableTop = (await bounds(table)).y
    expect(Math.abs(columnGrip.y + columnGrip.height / 2 - tableTop)).toBeLessThanOrEqual(1)
    expect(columnGrip.y).toBeLessThan(tableTop)
    expect(columnGrip.y + columnGrip.height).toBeGreaterThan(tableTop)
    await page.screenshot({ path: info.outputPath(`table-mobile-${width}.png`) })
    await table.getByText('Row 2, column 2', { exact: true }).tap()
    for (const orientation of ['Row', 'Column']) {
      const handle = page.getByRole('button', { name: `${orientation} 2 options`, exact: true })
      await expect(handle).toHaveAttribute('data-table-active-handle', 'true')
      await expect(handle).toHaveCSS('opacity', '1')
      const hit = await bounds(handle)
      expect(hit.width).toBe(44)
      expect(hit.height).toBe(44)
      await withinViewport(page, handle)
      await expect(handle.locator('svg circle')).toHaveCount(6)
    }
    await expect(page.getByRole('button', { name: 'Row 1 options', exact: true })).toHaveCSS('opacity', '0')
    await page.screenshot({ path: info.outputPath(`table-mobile-selected-${width}.png`) })
    await page.getByRole('button', { name: 'Column 2 options', exact: true }).tap()
    const menu = page.locator('.bn-table-handle-menu[data-state="open"]')
    await expect(menu).toBeVisible()
    await withinViewport(page, menu)
    await menu.getByRole('menuitem', { name: 'Add column right', exact: true }).tap()
    await expect(table.locator('tr:first-child :is(td, th)')).toHaveCount(4)
    await saved(page)
    expect((await persistedTable(page, acknowledgement.documentId)).rows[1]?.cells).toHaveLength(4)
    await table.getByText('Row 2, column 1', { exact: true }).tap()
    await page.getByRole('button', { name: 'Row 2 options', exact: true }).tap()
    await menu.getByRole('menuitem', { name: 'Delete row', exact: true }).tap()
    await saved(page)
    expect((await persistedTable(page, acknowledgement.documentId)).rows).toHaveLength(2)
    await page.reload()
    await expect(documentTable(page).locator('tr')).toHaveCount(2)
    await expect(documentTable(page).locator('tr:first-child :is(td, th)')).toHaveCount(4)
  })
}
