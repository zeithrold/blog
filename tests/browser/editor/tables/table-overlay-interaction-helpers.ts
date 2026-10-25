import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { saved, writeDocument } from '~/tests/support/browser/document'
import {
  documentTable,
  persistedTable,
  text,
} from './table-overlay-helpers'

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
