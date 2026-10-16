import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { withinViewport } from '~/tests/support/browser/layout'
import {
  bounds,
  cellText,
  checkBars,
  documentTable,
  persistedTable,
  revealTable,
  text,
  undoTable,
} from './table-overlay-helpers'

export async function verifyMouseTableInsertion(
  page: Page,
  documentId: string,
  orientation: 'column' | 'row',
): Promise<void> {
  const table = await revealTable(page)
  const before = await persistedTable(page, documentId)
  const row = orientation === 'row'
  const bar = await bounds(page.locator(row ? '.editor-table-row-bar' : '.editor-table-column-bar'))
  const first = await bounds(table.locator('tr').first().locator('td, th').first())
  const x = row ? bar.x + bar.width / 2 : bar.x + first.width
  const y = row ? bar.y + first.height : bar.y + bar.height / 2
  await page.mouse.move(x, y)
  const insert = page.locator(`[data-table-insert-${orientation}="1"]`)
  await expect(insert).toHaveCSS('opacity', '1')
  await insert.click()
  await expect(table.locator(row ? 'tr' : 'tr:first-child :is(td, th)')).toHaveCount(3)
  await saved(page)
  const after = await persistedTable(page, documentId)
  expect(text(after.rows[0]?.cells[0])).toBe('First cell')
  if (row) {
    expect(after.rows[1]?.cells.map(text)).toEqual(['', ''])
    expect(after.rows[2]?.cells.map(text)).toEqual(before.rows[1]?.cells.map(text))
  }
  else {
    expect(after.rows.every(item => text(item.cells[1]) === '')).toBe(true)
    expect(after.rows.map(item => text(item.cells[2]))).toEqual(before.rows.map(item => text(item.cells[1])))
  }
  expect((await undoTable(page, documentId)).rows.map(item => item.cells.map(text)))
    .toEqual(before.rows.map(item => item.cells.map(text)))
}

export async function editOffscreenColumn(page: Page, table: Locator, documentId: string): Promise<void> {
  await page.getByRole('button', { name: 'Column 8 options', exact: true }).click()
  const lastColumnMenu = page.locator('.bn-table-handle-menu[data-state="open"]')
  await expect(lastColumnMenu).toBeVisible()
  await withinViewport(page, lastColumnMenu)
  await lastColumnMenu.getByRole('menuitem', { name: 'Add column left', exact: true }).click()
  await expect(table.locator('tr:first-child :is(td, th)')).toHaveCount(9)
  await saved(page)
  const inserted = await persistedTable(page, documentId)
  expect(inserted.rows.every(row => row.cells.length === 9)).toBe(true)
  for (const [index, row] of inserted.rows.entries()) {
    expect(text(row.cells[6])).toBe(cellText(index, 6))
    expect(text(row.cells[7])).toBe('')
    expect(text(row.cells[8])).toBe(cellText(index, 7))
  }
  const restored = await undoTable(page, documentId)
  await expect(table.locator('tr:first-child :is(td, th)')).toHaveCount(8)
  expect(restored.rows.map(row => row.cells.map(text))).toEqual(
    Array.from({ length: 4 }, (_, row) => Array.from({ length: 8 }, (_cell, column) => cellText(row, column))),
  )
}

export async function verifyOffscreenColumnFocus(page: Page, table: Locator): Promise<void> {
  const viewport = table.locator('xpath=..')
  const scrollbar = page.getByRole('scrollbar', { name: 'Scroll table horizontally', exact: true })
  const offscreen = page.getByRole('button', { name: 'Column 8 options', exact: true })
  await expect(offscreen).not.toBeInViewport()
  await offscreen.focus()
  await expect(offscreen).toBeFocused()
  await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  await expect(offscreen).toBeInViewport()
  await expect(table.getByText('First cell', { exact: true })).not.toBeInViewport()
  await scrollbar.focus()
  await scrollbar.press('Home')
  await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBe(0)
  await expect(page.getByRole('button', { name: 'Column 1 options', exact: true })).toBeInViewport()
}

export async function verifyNativeColumnResize(page: Page, documentId: string, screenshotPath: string): Promise<void> {
  const table = await revealTable(page)
  const body = page.getByLabel('Document body', { exact: true })
  const cell = table.locator('tr').first().locator('td, th').first()
  const before = await persistedTable(page, documentId)
  const original = await bounds(cell)
  const start = { x: original.x + original.width - 1, y: original.y + original.height / 2 }
  await page.mouse.move(start.x, start.y)
  await expect(body).toHaveClass(/resize-cursor/)
  await expect(table.locator('.column-resize-handle').first()).toBeVisible()
  await page.mouse.down()
  try {
    await page.mouse.move(start.x + 40, start.y, { steps: 10 })
  }
  finally {
    await page.mouse.up()
  }
  await expect.poll(async () => (await bounds(cell)).width).toBeGreaterThan(original.width + 30)
  expect((await bounds(cell)).width).toBeLessThan(original.width + 50)
  await saved(page)
  const resized = await persistedTable(page, documentId)
  const originalWidth = before.columnWidths[0]
  const resizedWidth = resized.columnWidths[0]
  if (originalWidth === null || originalWidth === undefined || resizedWidth === null || resizedWidth === undefined) {
    throw new Error('Native resizing did not persist an explicit column width')
  }
  expect(Math.abs(resizedWidth - originalWidth - 40)).toBeLessThanOrEqual(2)
  expect(resized.columnWidths.slice(1)).toEqual(before.columnWidths.slice(1))
  expect(resized.rows.map(row => row.cells.map(text))).toEqual(before.rows.map(row => row.cells.map(text)))
  await revealTable(page)
  await checkBars(page, table)
  await page.screenshot({ path: screenshotPath })
  const restored = await undoTable(page, documentId)
  await expect.poll(async () => (await bounds(cell)).width).toBeCloseTo(original.width, 0)
  expect(restored.columnWidths).toEqual(before.columnWidths)
  expect(restored.rows.map(row => row.cells.map(text))).toEqual(before.rows.map(row => row.cells.map(text)))
  await page.reload()
  await expect(documentTable(page).getByText('First cell', { exact: true })).toBeVisible()
  const reloadedCell = documentTable(page).locator('tr').first().locator('td, th').first()
  await expect.poll(async () => (await bounds(reloadedCell)).width).toBeCloseTo(original.width, 0)
}

export async function verifyNativeSlashTable(page: Page): Promise<void> {
  const document = emptyDocument()
  document.meta.title = 'Native slash table'
  const acknowledgement = await writeDocument(page, document)
  const body = page.getByLabel('Document body', { exact: true })
  await body.click()
  await body.pressSequentially('/table')
  await page.getByRole('option').filter({ has: page.getByText('Table', { exact: true }) }).click()
  const table = documentTable(page)
  await expect(table.locator('tr')).toHaveCount(2)
  await expect(table.locator('tr').first().locator('td, th')).toHaveCount(3)
  await table.locator('td, th').first().click()
  await body.pressSequentially('Native table text')
  await saved(page)
  const before = await persistedTable(page, acknowledgement.documentId)
  expect(before.columnWidths).toHaveLength(3)
  expect(before.columnWidths.every(width => width === null)).toBe(true)
  await table.getByText('Native table text', { exact: true }).hover()
  const insert = page.locator('[data-table-insert-column="1"]')
  await page.keyboard.press('Tab')
  await insert.focus()
  await insert.press('Enter')
  await expect(table.locator('tr').first().locator('td, th')).toHaveCount(4)
  await saved(page)
  const after = await persistedTable(page, acknowledgement.documentId)
  expect(after.columnWidths).toHaveLength(4)
  expect(after.columnWidths.every(width => width === null)).toBe(true)
  expect(after.rows.every(row => row.cells.length === 4)).toBe(true)
  expect(text(after.rows[0]?.cells[0])).toBe('Native table text')
  expect(text(after.rows[0]?.cells[1])).toBe('')
  await page.reload()
  await expect(documentTable(page).locator('tr').first().locator('td, th')).toHaveCount(4)
  await expect(documentTable(page).getByText('Native table text', { exact: true })).toBeVisible()
}
