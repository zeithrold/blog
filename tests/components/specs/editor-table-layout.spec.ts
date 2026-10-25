import type { Locator, Page } from '@playwright/test'
import type { ApiService } from '../support/http-fixtures'
import {
  alignedContentEdges,
  alignedTableDocument,
  focusTableControl,
  leaveTable,
  readyAlignedBlocks,
  revealAlignedTable,
  sameTableLayout,
  tableControlsOpacity,
} from '~/tests/browser/editor/tables/table-content-alignment-helpers'
import {
  alignedBlockControls,
  bounds,
  cellText,
  checkBars,
  documentTable,
  expectTableControlAppearance,
  expectTouchTableRows,
  revealTable,
  tableDocument,
  tableScrollbar,
  text,
} from '~/tests/browser/editor/tables/table-overlay-helpers'
import { verifyOffscreenColumnFocus } from '~/tests/browser/editor/tables/table-overlay-interaction-helpers'
import { withinViewport } from '~/tests/support/browser/layout'
import {
  mountTableWorkspace,
  revisionCount,
  savedTable,
  undoRevision,
} from '../support/editor-table-fixtures'
import { expect, test } from '../support/test'

/**
 * Table alignment, scrolling and compact control geometry on the production
 * editor entry. Geometry and scroll positions are read from the real rendered
 * table; saves are asserted from the revision packet, and reads that used to
 * come from the Worker become the captured packet or a no-write check.
 */

/**
 * Adds a column before the last one from the offscreen menu and undoes it. The
 * packet proves the inserted empty cells and the restored eight columns.
 */
async function editOffscreenColumn(page: Page, api: ApiService, table: Locator): Promise<void> {
  await page.getByRole('button', { name: 'Column 8 options', exact: true }).click()
  const menu = page.locator('.bn-table-handle-menu[data-state="open"]')
  await expect(menu).toBeVisible()
  await withinViewport(page, menu)
  const before = revisionCount(api)
  await menu.getByRole('menuitem', { name: 'Add column left', exact: true }).click()
  await expect(table.locator('tr:first-child :is(td, th)')).toHaveCount(9)
  const inserted = await savedTable(page, api, before)
  expect(inserted.rows.every(row => row.cells.length === 9)).toBe(true)
  for (const [index, row] of inserted.rows.entries()) {
    expect(text(row.cells[6])).toBe(cellText(index, 6))
    expect(text(row.cells[7])).toBe('')
    expect(text(row.cells[8])).toBe(cellText(index, 7))
  }
  const restored = await undoRevision(page, api)
  await expect(table.locator('tr:first-child :is(td, th)')).toHaveCount(8)
  expect(restored.rows.map(row => row.cells.map(text))).toEqual(
    Array.from({ length: 4 }, (_row, row) =>
      Array.from({ length: 8 }, (_cell, column) => cellText(row, column))),
  )
}

test('table aligns with paragraph, code and formula while desktop controls toggle', async ({ page }, info) => {
  const { api } = await mountTableWorkspace(page, alignedTableDocument(), 1440)
  try {
    await page.setViewportSize({ width: 1440, height: 1200 })
    await readyAlignedBlocks(page)
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
    // Toggling controls is not an edit: no revision may leave the editor.
    expect(revisionCount(api)).toBe(0)
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
    expect(revisionCount(api)).toBe(0)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('mobile table aligns at 390 and 320px with its controls outside the body', async ({ page }, info) => {
  const { api } = await mountTableWorkspace(page, alignedTableDocument(), 390)
  try {
    await page.setViewportSize({ width: 390, height: 1200 })
    await readyAlignedBlocks(page)
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
    expect(revisionCount(api)).toBe(0)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

async function scrollWideTable(page: Page, table: Locator, width: number): Promise<void> {
  const viewport = table.locator('xpath=..')
  const scrollbar = await tableScrollbar(page, table)
  await checkBars(page, table)
  await expectTouchTableRows(page, 4, width === 390)
  const maximum = await viewport.evaluate(element => element.scrollWidth - element.clientWidth)
  expect(maximum).toBeGreaterThan(100)
  expect(await viewport.evaluate(element => element.scrollLeft)).toBe(0)
  const firstCellBefore = await bounds(table.locator('td, th').first())
  const thumb = scrollbar.locator('[data-slot="table-scroll-thumb"]')
  const thumbBounds = await bounds(thumb)
  const start = {
    x: thumbBounds.x + thumbBounds.width / 2,
    y: thumbBounds.y + thumbBounds.height / 2,
  }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  try {
    await page.mouse.move(start.x + 20, start.y, { steps: 8 })
  }
  finally {
    await page.mouse.up()
  }
  await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  const dragged = await viewport.evaluate(element => element.scrollLeft)
  expect(dragged).toBeLessThan(maximum)
  expect((await bounds(table.locator('td, th').first())).x).toBeLessThan(firstCellBefore.x - 1)
  await expect.poll(async () => Number(await scrollbar.getAttribute('aria-valuenow'))).toBeCloseTo(dragged, 0)
  await checkBars(page, table)
  await scrollbar.focus()
  await scrollbar.press('Home')
  await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBe(0)
  await scrollbar.press('ArrowRight')
  await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  const afterArrowRight = await viewport.evaluate(element => element.scrollLeft)
  await scrollbar.press('ArrowLeft')
  await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBeLessThan(afterArrowRight)
  await scrollbar.press('End')
  await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBeCloseTo(maximum, 0)
  if (width === 390) {
    await table.getByText('Row 1, column 8', { exact: true }).click()
  }
}

async function verifyWideTable(
  page: Page,
  api: ApiService,
  table: Locator,
  options: { width: number, screenshotPath: string },
): Promise<void> {
  await scrollWideTable(page, table, options.width)
  await expect(page.getByRole('button', { name: 'Column 8 options', exact: true })).toBeInViewport()
  await expect(table.getByText('First cell', { exact: true })).not.toBeInViewport()
  const scrollbar = await tableScrollbar(page, table)
  await withinViewport(page, scrollbar)
  await editOffscreenColumn(page, api, table)
  await scrollbar.focus()
  await scrollbar.press('Home')
  await expect.poll(async () => await table.locator('xpath=..').evaluate(element => element.scrollLeft)).toBe(0)
  await expect(page.getByRole('button', { name: 'Column 1 options', exact: true })).toBeInViewport()
  if (options.width === 1440) {
    await verifyOffscreenColumnFocus(page, table)
  }
  await page.screenshot({ path: options.screenshotPath })
  await page.mouse.wheel(0, 120)
  await revealTable(page)
  await checkBars(page, table)
}

test('wide table thumb drag and keyboard scrolling work at 1440 and 390px', async ({ page }, info) => {
  const { api } = await mountTableWorkspace(page, tableDocument(4, 8, 220), 1440)
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      const table = await revealTable(page)
      await verifyWideTable(page, api, table, {
        width,
        screenshotPath: info.outputPath(`table-scrollbar-${width}.png`),
      })
    }
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('mobile table grips stay reachable with block actions above the table', async ({ page }, info) => {
  const { api } = await mountTableWorkspace(page, tableDocument(), 390)
  try {
    await page.setViewportSize({ width: 390, height: 740 })
    const table = await revealTable(page)
    await checkBars(page, table)
    await expectTableControlAppearance(page)
    const group = page.locator('.editor-side[data-slot="button-group"]')
    await expect(group).toHaveAttribute('data-orientation', 'horizontal')
    await group.scrollIntoViewIfNeeded()
    await revealTable(page)
    await expect(group).toBeVisible()
    await withinViewport(page, group)
    await alignedBlockControls(page, group)
    for (const label of ['Row 1 options', 'Column 1 options']) {
      const button = page.getByRole('button', { name: label, exact: true })
      const buttonBounds = await bounds(button)
      expect(Math.min(buttonBounds.width, buttonBounds.height)).toBeGreaterThanOrEqual(44)
    }
    await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
    const blockActions = page.getByRole('dialog', { name: 'Block actions', exact: true })
    await expect(blockActions).toBeVisible()
    await expect(blockActions).toHaveCSS('opacity', '1')
    await withinViewport(page, blockActions)
    await page.screenshot({ path: info.outputPath('table-block-controls-mobile.png') })
    await page.keyboard.press('Escape')
    await expect(table).toBeVisible()
    expect(revisionCount(api)).toBe(0)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
