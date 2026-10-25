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

test.describe('drag edge scrolling', () => {
  test.use({ viewport: { width: 390, height: 900 }, hasTouch: true })
  test('touch column drag scrolls a wide table without releasing', async ({ page, browserName }, info) => {
    test.skip(browserName !== 'chromium', 'Physical touch requires Chromium CDP.')
    const acknowledgement = await writeDocument(page, tableDocument(3, 8, 140))
    const table = documentTable(page)
    await table.locator('td, th').first().tap()
    const viewport = table.locator('xpath=..')
    const hit = await bounds(page.locator('[data-table-control-column="0"]'))
    const first = { x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 }
    const box = await bounds(viewport)
    const edge = { x: box.x + box.width - 3, y: first.y }
    const session = await page.context().newCDPSession(page)
    await touchPoint(session, 'touchStart', first)
    await page.waitForTimeout(350)
    await touchPoint(session, 'touchMove', edge)
    await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(200)
    await page.screenshot({ path: info.outputPath('table-touch-autoscroll.png') })
    await touchPoint(session, 'touchEnd', edge)
    await saved(page)
    const moved = await persistedTable(page, acknowledgement.documentId)
    expect(moved.rows[0]?.cells.map(text).indexOf('First cell')).toBeGreaterThan(1)
    expect(moved.rows[0]?.cells).toHaveLength(8)
    await session.detach()
  })
})
