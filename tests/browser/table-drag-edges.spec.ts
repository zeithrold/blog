import { expect, test } from '@playwright/test'
import { saved, writeDocument } from './helpers'
import { moveMouseDrag, startMouseDrag, touchPoint } from './table-drag-helpers'
import {
  bounds,
  documentTable,
  mergedTableDocument,
  persistedTable,
  revealTable,
  tableDocument,
  text,
} from './table-overlay-helpers'

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
  const acknowledgement = await writeDocument(page, document)
  const table = await revealTable(page)
  await expect(page.locator('[data-table-control-column="0"]')).toHaveAttribute('data-table-draggable', 'false')
  await expect(page.locator('[data-table-control-row="0"]')).toHaveAttribute('data-table-draggable', 'false')
  const box = await bounds(table)
  const start = await startMouseDrag(page, 'column', 2)
  await moveMouseDrag(page, { x: box.x + 1, y: start.y })
  await expect(page.locator('[data-table-drag-preview]')).toHaveAttribute('data-table-drag-valid', 'false')
  await page.mouse.up()
  expect((await persistedTable(page, acknowledgement.documentId)).columnWidths).toEqual([
    120,
    180,
    140,
  ])
  await startMouseDrag(page, 'column', 2)
  await moveMouseDrag(page, { x: box.x + 120, y: start.y })
  await page.mouse.up()
  await saved(page)
  const moved = await persistedTable(page, acknowledgement.documentId)
  expect(moved.columnWidths).toEqual([
    120,
    140,
    180,
  ])
  expect(text(moved.rows[0]?.cells[0])).toBe('First cell')
  expect(moved.headerCols).toBe(1)
  expect(moved.headerRows).toBe(1)
})

for (const orientation of ['row', 'column'] as const) {
  test(`merged ${orientation} groups prevent splitting but allow safe drops`, async ({ page }) => {
    const acknowledgement = await writeDocument(page, mergedTableDocument(orientation))
    const table = await revealTable(page)
    const before = await persistedTable(page, acknowledgement.documentId)
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
    expect(await persistedTable(page, acknowledgement.documentId)).toEqual(before)
    await startMouseDrag(page, orientation, 2)
    const outside = orientation === 'row' ? { x: start.x, y: first.y } : { x: first.x, y: start.y }
    await moveMouseDrag(page, outside)
    await page.mouse.up()
    await saved(page)
    const merged = table.locator(orientation === 'row' ? '[rowspan="2"]' : '[colspan="2"]')
    await expect(merged).toHaveText('First cell')
    await page.reload()
    await expect(documentTable(page).locator(orientation === 'row' ? '[rowspan="2"]' : '[colspan="2"]'))
      .toHaveText('First cell')
  })
}

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

  test('row drag scrolls the page and cancels without moving content', async ({ page }) => {
    const acknowledgement = await writeDocument(page, tableDocument(30, 3, 100))
    const table = documentTable(page)
    await table.locator('td, th').first().tap()
    const before = await persistedTable(page, acknowledgement.documentId)
    const start = await startMouseDrag(page, 'row')
    await moveMouseDrag(page, { x: start.x, y: 885 })
    await expect.poll(async () => await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0))
      .toBeGreaterThan(120)
    await page.keyboard.press('Escape')
    await page.mouse.up()
    expect(await persistedTable(page, acknowledgement.documentId)).toEqual(before)
  })
})
