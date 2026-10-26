import {
  cellText,
  documentTable,
  revealTable,
  tableDocument,
  tableMenu,
  text,
} from '~/tests/browser/editor/tables/table-overlay-helpers'
import {
  mountTableWorkspace,
  revisionCount,
  savedTable,
  undoRevision,
} from '../support/editor-table-fixtures'
import { expect, test } from '../support/test'

/**
 * Boundary insertion and the final-segment guard on the production editor
 * entry. The packet the editor sends is the assertion; stored-table reads stay
 * with the retained E2E cases.
 */

for (const orientation of ['column', 'row'] as const) {
  test(`table ${orientation} insertion at every boundary saves and Undo restores the cells`, async ({ page }) => {
    const { api } = await mountTableWorkspace(page, tableDocument())
    const base = [
      ['First cell', 'Row 1, column 2'],
      ['Row 2, column 1', 'Row 2, column 2'],
    ]
    try {
      const table = documentTable(page)
      for (const boundary of [
        0,
        1,
        2,
      ]) {
        await revealTable(page)
        const insert = page.locator(`[data-table-insert-${orientation}="${boundary}"]`)
        await expect(insert).toHaveAttribute('aria-label', `Insert ${orientation} at position ${boundary + 1}`)
        await page.keyboard.press('Tab')
        await insert.focus()
        await expect(insert).toBeVisible()
        await expect(insert).toHaveCSS('opacity', '1')
        const before = revisionCount(api)
        await insert.press('Enter')
        await expect(table.locator(orientation === 'row' ? 'tr' : 'tr:first-child :is(td, th)')).toHaveCount(3)
        const snapshot = await savedTable(page, api, before)
        if (orientation === 'column') {
          expect(snapshot.rows.every(row => row.cells.length === 3)).toBe(true)
          for (const [index, row] of snapshot.rows.entries()) {
            const expected = [
              cellText(index, 0),
              cellText(index, 1),
            ]
            expected.splice(boundary, 0, '')
            expect(row.cells.map(text)).toEqual(expected)
          }
        }
        else {
          const expected = structuredClone(base)
          expected.splice(boundary, 0, ['', ''])
          expect(snapshot.rows.map(row => row.cells.map(text))).toEqual(expected)
        }
        const restored = await undoRevision(page, api)
        await expect(table.locator(orientation === 'row' ? 'tr' : 'tr:first-child :is(td, th)')).toHaveCount(2)
        expect(restored.rows.map(row => row.cells.map(text))).toEqual(base)
      }
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('blocked final-segment menus leave the live table unchanged', async ({ page }) => {
  const { api } = await mountTableWorkspace(page, tableDocument(1, 1))
  try {
    for (const orientation of ['Row', 'Column'] as const) {
      const menu = await tableMenu(page, orientation, 1)
      const deletion = menu.getByRole('menuitem', { name: `Delete ${orientation.toLowerCase()}`, exact: true })
      await expect(deletion).toBeDisabled()
      await page.keyboard.press('Escape')
    }
    await expect(documentTable(page).locator('tr')).toHaveCount(1)
    await expect(documentTable(page).locator('td, th')).toHaveCount(1)
    // A refused menu action is not a document change, so no revision may travel.
    expect(revisionCount(api)).toBe(0)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
