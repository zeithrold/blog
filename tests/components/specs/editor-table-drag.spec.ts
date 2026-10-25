import type { Table } from '@/content/document'
import { moveMouseDrag, startMouseDrag } from '~/tests/browser/editor/tables/table-drag-helpers'
import {
  bounds,
  mergedTableDocument,
  revealTable,
  tableDocument,
  text,
} from '~/tests/browser/editor/tables/table-overlay-helpers'
import {
  mountTableWorkspace,
  revisionCount,
  savedTable,
  tableAt,
  undoRevision,
} from '../support/editor-table-fixtures'
import { expect, test } from '../support/test'

/**
 * Native pointer row/column moves on the production editor entry. A drag is
 * only a save on drop; the case asserts the packet that drop produced and the
 * Undo that follows. The CDP physical-touch variants stay in E2E.
 */

test('desktop row and column drag saves only on drop and Undo restores the order', async ({ page }, info) => {
  const { api, open } = await mountTableWorkspace(page, tableDocument(3, 3, 120))
  const initial = tableAt(open)
  const original = initial.rows.map(row => row.cells.map(text))
  try {
    for (const orientation of ['row', 'column'] as const) {
      const table = await revealTable(page)
      const box = await bounds(table)
      const start = await startMouseDrag(page, orientation)
      const end = orientation === 'row'
        ? { x: start.x, y: box.y + box.height - 1 }
        : { x: box.x + box.width - 1, y: start.y }
      const hold = revisionCount(api)
      await moveMouseDrag(page, end)
      await expect(page.locator('[data-table-drag-preview]')).toHaveAttribute('data-table-drop-boundary', '3')
      expect(revisionCount(api)).toBe(hold)
      await page.screenshot({ path: info.outputPath(`table-drag-${orientation}.png`) })
      await page.mouse.up()
      await expect(page.locator('[data-table-drag-preview]')).toHaveCount(0)
      const expected = orientation === 'row'
        ? [
            original[1],
            original[2],
            original[0],
          ]
        : original.map(row => [
            row[1],
            row[2],
            row[0],
          ])
      const moved = await savedTable(page, api, hold)
      expect(moved.rows.map(row => row.cells.map(text))).toEqual(expected)
      expect(moved.columnWidths).toEqual(initial.columnWidths)
      const restored = await undoRevision(page, api)
      expect(restored.rows.map(row => row.cells.map(text))).toEqual(original)
      const redoBefore = revisionCount(api)
      await page.getByRole('button', { name: 'Redo', exact: true }).click()
      expect((await savedTable(page, api, redoBefore)).rows.map(row => row.cells.map(text))).toEqual(expected)
      // Return to the opened order before the next orientation.
      await undoRevision(page, api)
    }
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('Escape and releasing outside cancel without adding history', async ({ page }) => {
  const { api } = await mountTableWorkspace(page, tableDocument(3, 3, 120))
  try {
    const table = await revealTable(page)
    const box = await bounds(table)
    const undoDisabled = await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled()
    for (const cancel of ['escape', 'outside']) {
      const before = revisionCount(api)
      const start = await startMouseDrag(page, 'column')
      await moveMouseDrag(page, { x: box.x + box.width - 1, y: start.y })
      if (cancel === 'escape') {
        await page.keyboard.press('Escape')
      }
      else { await page.mouse.move(box.x + box.width + 100, box.y + box.height + 100) }
      await page.mouse.up()
      await expect(page.locator('[data-table-drag-preview]')).toHaveCount(0)
      expect(revisionCount(api)).toBe(before)
      expect(await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled()).toBe(undoDisabled)
    }
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('column widths travel with their column and headers keep their region', async ({ page }) => {
  const document = tableDocument(3, 3)
  const content = document.blocks[0]?.content
  if (content === undefined || Array.isArray(content)) {
    throw new Error('Missing table')
  }
  content.columnWidths = [
    120,
    180,
    140,
  ]
  content.headerRows = 1
  content.headerCols = 1
  const { api } = await mountTableWorkspace(page, document)
  try {
    const table = await revealTable(page)
    await expect(page.locator('[data-table-control-column="0"]')).toHaveAttribute('data-table-draggable', 'false')
    await expect(page.locator('[data-table-control-row="0"]')).toHaveAttribute('data-table-draggable', 'false')
    const box = await bounds(table)
    const start = await startMouseDrag(page, 'column', 2)
    await moveMouseDrag(page, { x: box.x + 1, y: start.y })
    await expect(page.locator('[data-table-drag-preview]')).toHaveAttribute('data-table-drag-valid', 'false')
    await page.mouse.up()
    expect(revisionCount(api)).toBe(0)
    await startMouseDrag(page, 'column', 2)
    await moveMouseDrag(page, { x: box.x + 120, y: start.y })
    const before = revisionCount(api)
    await page.mouse.up()
    const moved = await savedTable(page, api, before)
    expect(moved.columnWidths).toEqual([
      120,
      140,
      180,
    ])
    expect(text(moved.rows[0]?.cells[0])).toBe('First cell')
    expect(moved.headerCols).toBe(1)
    expect(moved.headerRows).toBe(1)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

for (const orientation of ['row', 'column'] as const) {
  test(`merged ${orientation} groups prevent splitting but allow safe drops`, async ({ page }) => {
    const { api } = await mountTableWorkspace(page, mergedTableDocument(orientation))
    try {
      const table = await revealTable(page)
      const first = await bounds(table.locator('tr').first().locator('td, th').first())
      await expect(page.locator(`[data-table-control-${orientation}="0"]`))
        .toHaveAttribute('data-table-draggable', 'false')
      const start = await startMouseDrag(page, orientation, 2)
      const inside = orientation === 'row'
        ? { x: start.x, y: first.y + first.height / 2 }
        : { x: first.x + first.width / 2, y: start.y }
      await moveMouseDrag(page, inside)
      await expect(page.locator('[data-table-drag-preview]')).toHaveAttribute('data-table-drag-valid', 'false')
      await page.mouse.up()
      expect(revisionCount(api)).toBe(0)
      await startMouseDrag(page, orientation, 2)
      const outside = orientation === 'row' ? { x: start.x, y: first.y } : { x: first.x, y: start.y }
      await moveMouseDrag(page, outside)
      const before = revisionCount(api)
      await page.mouse.up()
      const moved = await savedTable(page, api, before)
      const movedCell = moved.rows.flatMap(row => row.cells).find((cell) => {
        if (Array.isArray(cell)) {
          return false
        }
        return (orientation === 'row' ? cell.props.rowspan : cell.props.colspan) === 2
      })
      if (movedCell === undefined) {
        throw new Error('The merged table lost its two-cell span')
      }
      expect(text(movedCell)).toBe('First cell')
      await expect(table.locator(orientation === 'row' ? '[rowspan="2"]' : '[colspan="2"]'))
        .toHaveText('First cell')
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

/** The middle insertion leaves the new cell empty and every other cell in place. */
function expectMouseInsertion(after: Table, base: string[][], orientation: 'row' | 'column'): void {
  expect(text(after.rows[0]?.cells[0])).toBe('First cell')
  if (orientation === 'row') {
    expect(after.rows[1]?.cells.map(text)).toEqual(['', ''])
    expect(after.rows[2]?.cells.map(text)).toEqual(base[1])
  }
  else {
    expect(after.rows.every(item => text(item.cells[1]) === '')).toBe(true)
    expect(after.rows.map(item => text(item.cells[2]))).toEqual(base.map(item => item[1]))
  }
}

test('mouse clicks insert a middle column and row and Undo keeps the original cells', async ({ page }) => {
  const { api, open } = await mountTableWorkspace(page, tableDocument())
  const initial = tableAt(open)
  const base = initial.rows.map(row => row.cells.map(text))
  try {
    for (const orientation of ['column', 'row'] as const) {
      const table = await revealTable(page)
      const row = orientation === 'row'
      const bar = await bounds(page.locator(row ? '.editor-table-row-bar' : '.editor-table-column-bar'))
      const first = await bounds(table.locator('tr').first().locator('td, th').first())
      const x = row ? bar.x + bar.width / 2 : bar.x + first.width
      const y = row ? bar.y + first.height : bar.y + bar.height / 2
      await page.mouse.move(x, y)
      const insert = page.locator(`[data-table-insert-${orientation}="1"]`)
      await expect(insert).toHaveCSS('opacity', '1')
      const before = revisionCount(api)
      await insert.click()
      await expect(table.locator(row ? 'tr' : 'tr:first-child :is(td, th)')).toHaveCount(3)
      const after = await savedTable(page, api, before)
      expectMouseInsertion(after, base, orientation)
      const restored = await undoRevision(page, api)
      await expect(table.locator(row ? 'tr' : 'tr:first-child :is(td, th)')).toHaveCount(2)
      expect(restored.rows.map(item => item.cells.map(text))).toEqual(base)
    }
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
