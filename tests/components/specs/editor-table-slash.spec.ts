import { emptyDocument } from '@/content/document'
import { documentTable, text } from '~/tests/browser/editor/tables/table-overlay-helpers'
import {
  mountTableWorkspace,
  revisionCount,
  savedTable,
} from '../support/editor-table-fixtures'
import { expect, test } from '../support/test'

/**
 * Slash-table creation and middle insertion on the production editor entry.
 * The packet proves the unset widths and inserted cells; the retained E2E case
 * keeps the same table through a real Worker save and reload.
 */

test('native slash table keeps unset widths through middle insertion', async ({ page }) => {
  const { api } = await mountTableWorkspace(page, emptyDocument())
  try {
    const body = page.getByLabel('Document body', { exact: true })
    await body.click()
    await body.pressSequentially('/table')
    await page.getByRole('option').filter({ has: page.getByText('Table', { exact: true }) }).click()
    const table = documentTable(page)
    await expect(table.locator('tr')).toHaveCount(2)
    await expect(table.locator('tr').first().locator('td, th')).toHaveCount(3)
    await table.locator('td, th').first().click()
    const typeBefore = revisionCount(api)
    await body.pressSequentially('Native table text')
    const typed = await savedTable(page, api, typeBefore)
    expect(typed.columnWidths).toHaveLength(3)
    expect(typed.columnWidths.every(width => width === null)).toBe(true)
    expect(text(typed.rows[0]?.cells[0])).toBe('Native table text')
    await table.getByText('Native table text', { exact: true }).hover()
    const insert = page.locator('[data-table-insert-column="1"]')
    await page.keyboard.press('Tab')
    await insert.focus()
    const insertBefore = revisionCount(api)
    await insert.press('Enter')
    await expect(table.locator('tr').first().locator('td, th')).toHaveCount(4)
    const inserted = await savedTable(page, api, insertBefore)
    expect(inserted.columnWidths).toHaveLength(4)
    expect(inserted.columnWidths.every(width => width === null)).toBe(true)
    expect(inserted.rows.every(row => row.cells.length === 4)).toBe(true)
    expect(text(inserted.rows[0]?.cells[0])).toBe('Native table text')
    expect(text(inserted.rows[0]?.cells[1])).toBe('')
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
