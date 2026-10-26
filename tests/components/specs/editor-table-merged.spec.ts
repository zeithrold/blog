import {
  enterColumnControl,
  escapeToCell,
  keyboardTableDocument,
  openFocusedTableMenu,
  pressCellTabs,
  startInCell,
  tableCaret,
} from '~/tests/browser/editor/tables/table-keyboard-helpers'
import {
  checkBars,
  documentTable,
  expectMergedInsertion,
  mergedTableDocument,
  revealTable,
  tableDocument,
  tableMenu,
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
 * Merged table groups and menu-driven moves on the production editor entry.
 * Spans, boundaries and the final-group guard are asserted on the revision
 * packet; the stored copy stays with the retained reload representatives.
 */

for (const orientation of ['column', 'row'] as const) {
  test(`merged ${orientation} controls preserve spans and protect the final group`, async ({ page }) => {
    const { api, open } = await mountTableWorkspace(page, mergedTableDocument(orientation))
    const initial = tableAt(open)
    try {
      const table = await revealTable(page)
      const row = orientation === 'row'
      const mergedLabel = row ? 'Rows 1–2 options' : 'Columns 1–2 options'
      const lastLabel = row ? 'Row 3 options' : 'Column 3 options'
      await expect(page.getByRole('button', { name: mergedLabel, exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: lastLabel, exact: true })).toBeVisible()
      await expect(page.locator(row ? '.editor-table-row-bar' : '.editor-table-column-bar')
        .getByRole('button', { name: /options$/ })).toHaveCount(2)
      await checkBars(page, table)
      const boundary = page.locator(`[data-table-insert-${orientation}="1"]`)
      await expect(boundary).toHaveAttribute('aria-label', `Insert ${orientation} at position 3`)
      await page.keyboard.press('Tab')
      await boundary.focus()
      await expect(boundary).toHaveCSS('opacity', '1')
      const insertBefore = revisionCount(api)
      await boundary.press('Enter')
      const inserted = await savedTable(page, api, insertBefore)
      expectMergedInsertion(initial, inserted, orientation)
      expect(await undoRevision(page, api)).toEqual(initial)
      await revealTable(page)
      await page.getByRole('button', { name: lastLabel, exact: true }).click()
      const menu = page.locator('.bn-table-handle-menu[data-state="open"]')
      await expect(menu).toBeVisible()
      const deleteBefore = revisionCount(api)
      await menu.getByRole('menuitem', { name: `Delete ${orientation}`, exact: true }).click()
      const remaining = await savedTable(page, api, deleteBefore)
      expect(row ? remaining.rows.length : remaining.columnWidths.length).toBe(2)
      expect(remaining.rows[0]?.cells[0]).toEqual(initial.rows[0]?.cells[0])
      await revealTable(page)
      await page.getByRole('button', { name: mergedLabel, exact: true }).click()
      await expect(menu.getByRole('menuitem', { name: `Delete ${orientation}`, exact: true })).toBeDisabled()
      await page.keyboard.press('Escape')
      expect(await undoRevision(page, api)).toEqual(initial)
      await revealTable(page)
      await expect(page.getByRole('button', { name: lastLabel, exact: true })).toBeVisible()
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('menu offers keyboard row and column moves', async ({ page }) => {
  const { api } = await mountTableWorkspace(page, tableDocument(3, 3, 120))
  try {
    const rowBefore = revisionCount(api)
    await (await tableMenu(page, 'Row', 2)).getByRole('menuitem', { name: 'Move row up', exact: true }).press('Enter')
    const movedRow = await savedTable(page, api, rowBefore)
    expect(text(movedRow.rows[0]?.cells[0])).toBe('Row 2, column 1')
    const columnBefore = revisionCount(api)
    await (await tableMenu(page, 'Column', 1)).getByRole('menuitem', { name: 'Move column right', exact: true }).click()
    const movedColumn = await savedTable(page, api, columnBefore)
    expect(text(movedColumn.rows[0]?.cells[0])).toBe('Row 2, column 2')
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

for (const width of [1440, 320]) {
  test(`current lower-row cells map to merged column controls at ${width}px`, async ({ page }) => {
    const { api } = await mountTableWorkspace(page, keyboardTableDocument(true), width)
    try {
      const tables = documentTable(page)
      await expect(tables).toHaveCount(2)
      const second = tables.nth(1)
      await startInCell(page, second, 'Second First cell')
      await pressCellTabs(page, 3)
      expect((await tableCaret(page)).cell).toBe('Second Row 2, column 2')
      let caret = await tableCaret(page)
      await enterColumnControl(page, second, 'Columns 1–2 options')
      await escapeToCell(page, caret)
      await pressCellTabs(page, 1)
      expect((await tableCaret(page)).cell).toBe('Second Row 2, column 3')
      caret = await tableCaret(page)
      await enterColumnControl(page, second, 'Column 3 options')
      await openFocusedTableMenu(page, 'Add column left')
      await escapeToCell(page, caret)
      // Reading merged controls is not an edit; no revision may leave.
      expect(revisionCount(api)).toBe(0)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
