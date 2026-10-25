import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'
import {
  checkBars,
  expectMergedInsertion,
  mergedTableDocument,
  persistedTable,
  revealTable,
  undoTable,
} from './table-overlay-helpers'
import { verifyNativeSlashTable } from './table-overlay-interaction-helpers'

for (const orientation of ['column', 'row'] as const) {
  test(`merged ${orientation} controls preserve spans and protect the final group`, async ({ page }) => {
    const acknowledgement = await writeDocument(page, mergedTableDocument(orientation))
    const table = await revealTable(page)
    const before = await persistedTable(page, acknowledgement.documentId)
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
    await boundary.press('Enter')
    await saved(page)
    expectMergedInsertion(before, await persistedTable(page, acknowledgement.documentId), orientation)
    expect(await undoTable(page, acknowledgement.documentId)).toEqual(before)
    await revealTable(page)
    await page.getByRole('button', { name: lastLabel, exact: true }).click()
    const menu = page.locator('.bn-table-handle-menu[data-state="open"]')
    await expect(menu).toBeVisible()
    await menu.getByRole('menuitem', { name: `Delete ${orientation}`, exact: true }).click()
    await saved(page)
    const remaining = await persistedTable(page, acknowledgement.documentId)
    expect(row ? remaining.rows.length : remaining.columnWidths.length).toBe(2)
    expect(remaining.rows[0]?.cells[0]).toEqual(before.rows[0]?.cells[0])
    await revealTable(page)
    await page.getByRole('button', { name: mergedLabel, exact: true }).click()
    await expect(menu.getByRole('menuitem', { name: `Delete ${orientation}`, exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    expect(await undoTable(page, acknowledgement.documentId)).toEqual(before)
    await page.reload()
    await revealTable(page)
    await expect(page.getByRole('button', { name: lastLabel, exact: true })).toBeVisible()
    expect(await persistedTable(page, acknowledgement.documentId)).toEqual(before)
  })
}

test('native slash table keeps unset widths through middle insertion and reload', async ({ page }) => {
  await verifyNativeSlashTable(page)
})
