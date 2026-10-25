import { moveMouseDrag, startMouseDrag } from '~/tests/browser/editor/tables/table-drag-helpers'
import {
  alignedBlockControls,
  bounds,
  checkBars,
  documentTable,
  tableDocument,
} from '~/tests/browser/editor/tables/table-overlay-helpers'
import { withinViewport } from '~/tests/support/browser/layout'
import {
  mountTableWorkspace,
  revisionCount,
  savedTable,
} from '../support/editor-table-fixtures'
import { expect, test } from '../support/test'

// Touch selection is Playwright's cross-browser touch input, not the CDP
// physical-touch sessions that stay in E2E.
test.use({ hasTouch: true })

/**
 * Compact table grips and page-edge drag scrolling on the production editor
 * entry. Touch selects the cell; the assertions are the rendered hit geometry
 * and the revision packet the menu/drag produced.
 */

for (const width of [
  320,
  390,
  486,
]) {
  test(`mobile table grips follow the touched cell at ${width}px`, async ({ page }, info) => {
    const { api } = await mountTableWorkspace(page, tableDocument(3, 3, 100), width)
    try {
      await page.setViewportSize({ width, height: 900 })
      const table = documentTable(page)
      await table.locator('td, th').first().tap()
      await checkBars(page, table)
      const group = page.locator('.editor-side[data-slot="button-group"]')
      await expect(group).toBeVisible()
      await alignedBlockControls(page, group)
      await expect(page.locator('[data-table-active-handle="true"]')).toHaveCount(2)
      const columnHandle = page.getByRole('button', { name: 'Column 1 options', exact: true })
      const columnGrip = await bounds(columnHandle.locator('span'))
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
      const addBefore = revisionCount(api)
      await menu.getByRole('menuitem', { name: 'Add column right', exact: true }).tap()
      await expect(table.locator('tr:first-child :is(td, th)')).toHaveCount(4)
      expect((await savedTable(page, api, addBefore)).rows[1]?.cells).toHaveLength(4)
      await table.getByText('Row 2, column 1', { exact: true }).tap()
      await page.getByRole('button', { name: 'Row 2 options', exact: true }).tap()
      const deleteBefore = revisionCount(api)
      await menu.getByRole('menuitem', { name: 'Delete row', exact: true }).tap()
      expect((await savedTable(page, api, deleteBefore)).rows).toHaveLength(2)
      await expect(documentTable(page).locator('tr')).toHaveCount(2)
      await expect(documentTable(page).locator('tr:first-child :is(td, th)')).toHaveCount(4)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('row drag scrolls the page and cancels without moving content', async ({ page }) => {
  const { api } = await mountTableWorkspace(page, tableDocument(30, 3, 100), 390)
  try {
    await page.setViewportSize({ width: 390, height: 900 })
    const table = documentTable(page)
    await table.locator('td, th').first().tap()
    const start = await startMouseDrag(page, 'row')
    await moveMouseDrag(page, { x: start.x, y: 885 })
    await expect.poll(async () => await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0))
      .toBeGreaterThan(120)
    await page.keyboard.press('Escape')
    await page.mouse.up()
    expect(revisionCount(api)).toBe(0)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
