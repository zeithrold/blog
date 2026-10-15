import { expect, test } from '@playwright/test'
import { withinViewport } from './block-action-helpers'
import { writeDocument } from './helpers'
import {
  alignedContentEdges,
  alignedTableDocument,
  focusTableControl,
  leaveTable,
  readyAlignedBlocks,
  revealAlignedTable,
  sameTableLayout,
  tableControlsOpacity,
} from './table-content-alignment-helpers'
import {
  checkBars,
  documentTable,
  expectTouchTableRows,
  persistedTable,
  tableScrollbar,
} from './table-overlay-helpers'

test('table aligns with paragraph, code and formula while desktop controls toggle', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  const acknowledgement = await writeDocument(page, alignedTableDocument())
  await readyAlignedBlocks(page)
  const stored = await persistedTable(page, acknowledgement.documentId)
  await leaveTable(page)
  await tableControlsOpacity(page, '0')
  const hidden = await alignedContentEdges(page)
  await revealAlignedTable(page)
  await tableControlsOpacity(page, '1')
  sameTableLayout(hidden, await alignedContentEdges(page))
  await checkBars(page, documentTable(page))
  const control = await focusTableControl(page)
  await tableControlsOpacity(page, '1')
  sameTableLayout(hidden, await alignedContentEdges(page))
  await control.click()
  const menu = page.locator('.bn-table-handle-menu[data-state="open"]')
  await expect(menu).toBeVisible()
  await page.mouse.move(1, 1)
  await tableControlsOpacity(page, '1')
  sameTableLayout(hidden, await alignedContentEdges(page))
  await withinViewport(page, menu)
  await page.keyboard.press('Escape')
  await leaveTable(page)
  await tableControlsOpacity(page, '0')
  sameTableLayout(hidden, await alignedContentEdges(page))
  expect(await persistedTable(page, acknowledgement.documentId)).toEqual(stored)
  await page.screenshot({ path: info.outputPath('table-alignment-hidden-1440.png') })
  await revealAlignedTable(page)
  await page.screenshot({ path: info.outputPath('table-alignment-visible-1440.png') })
  await page.setViewportSize({ width: 701, height: 1200 })
  await leaveTable(page)
  await tableControlsOpacity(page, '0')
  const hiddenBoundary = await alignedContentEdges(page)
  await revealAlignedTable(page)
  await tableControlsOpacity(page, '1')
  sameTableLayout(hiddenBoundary, await alignedContentEdges(page))
  await checkBars(page, documentTable(page))
  await page.screenshot({ path: info.outputPath('table-alignment-visible-701.png') })
})

test('mobile table aligns at 390 and 320px with its controls outside the body', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 1200 })
  const acknowledgement = await writeDocument(page, alignedTableDocument())
  await readyAlignedBlocks(page)
  const stored = await persistedTable(page, acknowledgement.documentId)
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 1200 })
    await leaveTable(page)
    await tableControlsOpacity(page, '1')
    const inactive = await alignedContentEdges(page)
    const table = await revealAlignedTable(page)
    sameTableLayout(inactive, await alignedContentEdges(page))
    await checkBars(page, table)
    await expectTouchTableRows(page, 2, true)
    await focusTableControl(page)
    await tableControlsOpacity(page, '1')
    sameTableLayout(inactive, await alignedContentEdges(page))
    const viewport = table.locator('xpath=..')
    expect(await viewport.evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThan(100)
    const scrollbar = await tableScrollbar(page, table)
    await scrollbar.focus()
    await scrollbar.press('End')
    await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(100)
    sameTableLayout(inactive, await alignedContentEdges(page, false))
    await checkBars(page, table)
    await scrollbar.press('Home')
    await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBe(0)
    await leaveTable(page)
    await tableControlsOpacity(page, '1')
    sameTableLayout(inactive, await alignedContentEdges(page))
    await page.screenshot({ path: info.outputPath(`table-alignment-${width}.png`) })
  }
  expect(await persistedTable(page, acknowledgement.documentId)).toEqual(stored)
})
