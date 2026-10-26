import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'
import { touchPoint } from './table-drag-helpers'
import {
  bounds,
  documentTable,
  persistedTable,
  tableDocument,
  text,
} from './table-overlay-helpers'

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
