import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'
import { moveMouseDrag, startMouseDrag, touchPoint } from './table-drag-helpers'
import {
  bounds,
  documentTable,
  persistedTable,
  revealTable,
  tableDocument,
  tableMenu,
  text,
  undoTable,
} from './table-overlay-helpers'

for (const orientation of ['row', 'column'] as const) {
  test(`desktop ${orientation} drag saves only on drop, undoes once and reloads`, async ({ page }, info) => {
    const acknowledgement = await writeDocument(page, tableDocument(3, 3, 120))
    const table = await revealTable(page)
    const before = await persistedTable(page, acknowledgement.documentId)
    const original = before.rows.map(row => row.cells.map(text))
    const box = await bounds(table)
    const start = await startMouseDrag(page, orientation)
    const end = orientation === 'row'
      ? { x: start.x, y: box.y + box.height - 1 }
      : { x: box.x + box.width - 1, y: start.y }
    await moveMouseDrag(page, end)
    await expect(page.locator('[data-table-drag-preview]')).toHaveAttribute('data-table-drop-boundary', '3')
    expect((await persistedTable(page, acknowledgement.documentId)).rows.map(row => row.cells.map(text)))
      .toEqual(original)
    await page.screenshot({ path: info.outputPath(`table-drag-${orientation}.png`) })
    await page.mouse.up()
    await expect(page.locator('[data-table-drag-preview]')).toHaveCount(0)
    await saved(page)
    const moved = await persistedTable(page, acknowledgement.documentId)
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
    expect(moved.rows.map(row => row.cells.map(text))).toEqual(expected)
    expect(moved.columnWidths).toEqual(before.columnWidths)
    expect((await undoTable(page, acknowledgement.documentId)).rows.map(row => row.cells.map(text))).toEqual(original)
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    await saved(page)
    await page.reload()
    await expect(documentTable(page)).toBeVisible()
    const reloaded = await persistedTable(page, acknowledgement.documentId)
    expect(reloaded.rows.map(row => row.cells.map(text))).toEqual(expected)
  })
}

test('Escape and releasing outside cancel without adding history', async ({ page }) => {
  const acknowledgement = await writeDocument(page, tableDocument(3, 3, 120))
  const table = await revealTable(page)
  const before = await persistedTable(page, acknowledgement.documentId)
  const box = await bounds(table)
  const undoDisabled = await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled()
  for (const cancel of ['escape', 'outside']) {
    const start = await startMouseDrag(page, 'column')
    await moveMouseDrag(page, { x: box.x + box.width - 1, y: start.y })
    if (cancel === 'escape') {
      await page.keyboard.press('Escape')
    }
    else { await page.mouse.move(box.x + box.width + 100, box.y + box.height + 100) }
    await page.mouse.up()
    await expect(page.locator('[data-table-drag-preview]')).toHaveCount(0)
    expect(await persistedTable(page, acknowledgement.documentId)).toEqual(before)
    expect(await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled()).toBe(undoDisabled)
  }
})

test('menu offers keyboard row and column moves', async ({ page }) => {
  const acknowledgement = await writeDocument(page, tableDocument(3, 3, 120))
  await (await tableMenu(page, 'Row', 2)).getByRole('menuitem', { name: 'Move row up', exact: true }).press('Enter')
  await saved(page)
  expect(text((await persistedTable(page, acknowledgement.documentId)).rows[0]?.cells[0])).toBe('Row 2, column 1')
  await (await tableMenu(page, 'Column', 1)).getByRole('menuitem', { name: 'Move column right', exact: true }).click()
  await saved(page)
  expect(text((await persistedTable(page, acknowledgement.documentId)).rows[0]?.cells[0])).toBe('Row 2, column 2')
})

test.describe('touch table dragging', () => {
  test.use({ viewport: { width: 390, height: 900 }, hasTouch: true })
  for (const orientation of ['row', 'column'] as const) {
    test(`long press ${orientation} handle reorders and stays usable`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Chromium CDP drives physical touch; mouse coverage runs on all browsers.')
      const acknowledgement = await writeDocument(page, tableDocument(3, 3, 100))
      const table = documentTable(page)
      await table.locator('td, th').first().tap()
      const handle = page.locator(`[data-table-control-${orientation}="0"]`)
      const box = await bounds(handle)
      const first = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      const tableBox = await bounds(table)
      const end = orientation === 'row'
        ? { x: first.x, y: tableBox.y + tableBox.height - 1 }
        : { x: tableBox.x + tableBox.width - 1, y: first.y }
      const session = await page.context().newCDPSession(page)
      await touchPoint(session, 'touchStart', first)
      await page.waitForTimeout(350)
      await touchPoint(session, 'touchMove', end)
      await expect(page.locator('[data-table-drag-preview]')).toHaveAttribute('data-table-drop-boundary', '3')
      await touchPoint(session, 'touchEnd', end)
      await saved(page)
      const moved = await persistedTable(page, acknowledgement.documentId)
      expect(text(moved.rows[0]?.cells[0])).toBe(orientation === 'row' ? 'Row 2, column 1' : 'Row 1, column 2')
      await page.locator(`[data-table-control-${orientation}="2"]`).tap()
      await expect(page.locator('.bn-table-handle-menu[data-state="open"]')).toBeVisible()
      await session.detach()
    })
  }

  test('early touch movement and system cancellation leave content intact', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Physical touch requires Chromium CDP.')
    const acknowledgement = await writeDocument(page, tableDocument(3, 3, 100))
    await documentTable(page).locator('td, th').first().tap()
    const before = await persistedTable(page, acknowledgement.documentId)
    const box = await bounds(page.locator('[data-table-control-column="0"]'))
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const end = { ...point, x: point.x + 80 }
    const session = await page.context().newCDPSession(page)
    for (const delay of [0, 350]) {
      await touchPoint(session, 'touchStart', point)
      if (delay > 0) {
        await page.waitForTimeout(delay)
      }
      await touchPoint(session, 'touchMove', end)
      await touchPoint(session, 'touchCancel', end)
      await expect(page.locator('[data-table-drag-preview]')).toHaveCount(0)
      await expect(page.locator('.bn-table-handle-menu[data-state="open"]')).toHaveCount(0)
      expect(await persistedTable(page, acknowledgement.documentId)).toEqual(before)
    }
    await session.detach()
  })
})
