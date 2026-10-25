import { TABLE_COLUMN_MAX_WIDTH, TABLE_COLUMN_MIN_WIDTH } from '@/content/table-limits'
import {
  alignedBlockControls,
  bounds,
  checkBars,
  clearOfControls,
  documentTable,
  expectTableControlAppearance,
  expectTableSegments,
  revealTable,
  tableDocument,
  tableMenu,
  text,
} from '~/tests/browser/editor/tables/table-overlay-helpers'
import {
  columnWidth,
  resizeBoundaryColumn,
  widthBoundaryDocument,
} from '~/tests/browser/editor/tables/table-width-limits-helpers'
import { withinViewport } from '~/tests/support/browser/layout'
import {
  mountTableWorkspace,
  revisionCount,
  savedTable,
  tableAt,
  undoRevision,
} from '../support/editor-table-fixtures'
import { expect, test } from '../support/test'

/**
 * Table option and geometry cases on the production editor entry. The case
 * asserts the revision packet the editor sends; a mocked acknowledgement never
 * claims the table was stored. D1 persistence, canonical widths and the actual
 * save/reload journey stay with the Worker tests and the retained E2E cases.
 */
test('table option menus add and delete rows and columns and keep the bar geometry', async ({ page }, info) => {
  const { api } = await mountTableWorkspace(page, tableDocument())
  try {
    const table = await revealTable(page)
    await checkBars(page, table)
    await expectTableControlAppearance(page)
    await expectTableSegments(page, 2, 2)
    const group = page.locator('.editor-side[data-slot="button-group"]')
    await expect(group).toHaveAttribute('data-orientation', 'horizontal')
    await alignedBlockControls(page, group)

    const rowMenu = await tableMenu(page, 'Row', 1)
    expect((await bounds(rowMenu)).width).toBeLessThanOrEqual(240)
    const rowBorder = await rowMenu.evaluate(element => getComputedStyle(element).borderColor)
    expect(rowBorder).not.toBe('rgb(0, 0, 0)')
    await rowMenu.getByRole('menuitem', { name: 'Add row below', exact: true }).click()
    await expect(table.locator('tr')).toHaveCount(3)

    const before = revisionCount(api)
    const columnMenu = await tableMenu(page, 'Column', 2)
    await columnMenu.getByRole('menuitem', { name: 'Add column right', exact: true }).click()
    for (const row of await table.locator('tr').all()) {
      await expect(row.locator('td, th')).toHaveCount(3)
    }
    const added = await savedTable(page, api, before)
    expect(added.rows).toHaveLength(3)
    expect(added.rows.every(row => row.cells.length === 3)).toBe(true)
    expect(text(added.rows[0]?.cells[0])).toBe('First cell')
    expect(text(added.rows[1]?.cells[0])).toBe('')
    expect(text(added.rows[2]?.cells[1])).toBe('Row 2, column 2')

    await revealTable(page)
    await checkBars(page, documentTable(page))
    await page.screenshot({ path: info.outputPath('table-continuous-controls.png') })
    await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
    const blockMenu = page.locator('.editor-desktop-block-actions')
    await expect(blockMenu).toBeVisible()
    await expect(blockMenu).toHaveCSS('opacity', '1')
    expect((await bounds(blockMenu)).width).toBeLessThanOrEqual(240)
    await expect(blockMenu.getByRole('button', { name: 'Header row', exact: true }))
      .toHaveText('Header row')
    const blockBorder = await blockMenu.evaluate(element => getComputedStyle(element).borderColor)
    expect(blockBorder).not.toBe('rgb(0, 0, 0)')
    await clearOfControls(blockMenu, group)
    await withinViewport(page, blockMenu)
    await page.keyboard.press('Escape')

    const deleteBefore = revisionCount(api)
    await (await tableMenu(page, 'Row', 2)).getByRole('menuitem', { name: 'Delete row', exact: true }).click()
    await (await tableMenu(page, 'Column', 3)).getByRole('menuitem', { name: 'Delete column', exact: true }).click()
    const restored = await savedTable(page, api, deleteBefore)
    expect(restored.rows.map(row => row.cells.map(text))).toEqual([
      ['First cell', 'Row 1, column 2'],
      ['Row 2, column 1', 'Row 2, column 2'],
    ])
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('native column resizing saves widths and Undo restores the original table', async ({ page }, info) => {
  const { api, open } = await mountTableWorkspace(page, tableDocument())
  const initial = tableAt(open)
  try {
    const table = await revealTable(page)
    const body = page.getByLabel('Document body', { exact: true })
    const cell = table.locator('tr').first().locator('td, th').first()
    const original = await bounds(cell)
    const start = { x: original.x + original.width - 1, y: original.y + original.height / 2 }
    await page.mouse.move(start.x, start.y)
    await expect(body).toHaveClass(/resize-cursor/)
    await expect(table.locator('.column-resize-handle').first()).toBeVisible()
    const before = revisionCount(api)
    await page.mouse.down()
    try {
      await page.mouse.move(start.x + 40, start.y, { steps: 10 })
    }
    finally {
      await page.mouse.up()
    }
    await expect.poll(async () => (await bounds(cell)).width).toBeGreaterThan(original.width + 30)
    expect((await bounds(cell)).width).toBeLessThan(original.width + 50)
    const resized = await savedTable(page, api, before)
    const originalWidth = initial.columnWidths[0]
    const resizedWidth = resized.columnWidths[0]
    if (originalWidth === null || originalWidth === undefined
      || resizedWidth === null || resizedWidth === undefined) {
      throw new Error('Native resizing did not save an explicit column width')
    }
    expect(Math.abs(resizedWidth - originalWidth - 40)).toBeLessThanOrEqual(2)
    expect(resized.columnWidths.slice(1)).toEqual(initial.columnWidths.slice(1))
    expect(resized.rows.map(row => row.cells.map(text))).toEqual(initial.rows.map(row => row.cells.map(text)))
    await revealTable(page)
    await checkBars(page, table)
    await page.screenshot({ path: info.outputPath('table-native-column-resize.png') })
    const restored = await undoRevision(page, api)
    await expect.poll(async () => (await bounds(cell)).width).toBeCloseTo(original.width, 0)
    expect(restored.columnWidths).toEqual(initial.columnWidths)
    expect(restored.rows.map(row => row.cells.map(text))).toEqual(initial.rows.map(row => row.cells.map(text)))
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('native minimum and maximum column widths save and remain one Undo', async ({ page }, info) => {
  const { api } = await mountTableWorkspace(page, widthBoundaryDocument())
  const initial = [
    120,
    180,
    null,
  ]
  try {
    const table = documentTable(page)
    for (const boundary of [
      { name: 'minimum', width: 1440, drag: -200, result: TABLE_COLUMN_MIN_WIDTH },
      { name: 'maximum', width: 4096, drag: 2100, result: TABLE_COLUMN_MAX_WIDTH },
    ]) {
      if (page.viewportSize()?.width !== boundary.width) {
        await page.setViewportSize({ width: boundary.width, height: 1000 })
      }
      const before = revisionCount(api)
      await resizeBoundaryColumn(page, boundary.drag)
      const resized = await savedTable(page, api, before)
      await columnWidth(table, boundary.result)
      expect(resized.columnWidths).toEqual([
        boundary.result,
        180,
        null,
      ])
      const undone = await undoRevision(page, api)
      await columnWidth(table, 120)
      expect(undone.columnWidths).toEqual(initial)
      const redoBefore = revisionCount(api)
      await page.getByRole('toolbar', { name: 'Editor actions', exact: true })
        .getByRole('button', { name: 'Redo', exact: true })
        .click()
      const redone = await savedTable(page, api, redoBefore)
      expect(redone.columnWidths).toEqual([
        boundary.result,
        180,
        null,
      ])
      if (boundary.name === 'minimum') {
        // The next boundary starts from the unset replacement width.
        expect((await undoRevision(page, api)).columnWidths).toEqual(initial)
      }
      await expect(page.getByRole('alert')).toHaveCount(0)
      await page.screenshot({ path: info.outputPath(`table-width-${boundary.name}.png`) })
    }
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
