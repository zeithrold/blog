import type { Locator, Page } from '@playwright/test'
import type { Document, Table } from '@/content/document'
import { expect } from '@playwright/test'
import { saved } from '~/tests/support/browser/document'
import { bounds, documentTable, persistedTable, tableDocument } from './table-overlay-helpers'

export function widthBoundaryDocument(): Document {
  const document = tableDocument(2, 3)
  document.meta.title = 'Native table width boundaries'
  const content = document.blocks[0]?.content
  if (content === undefined || Array.isArray(content)) {
    throw new Error('The width fixture has no native table content')
  }
  content.columnWidths = [
    120,
    180,
    null,
  ]
  content.headerRows = 1
  content.rows = content.rows.map(row => ({
    cells: row.cells.map(cell => ({
      type: 'tableCell',
      props: { textAlignment: 'left', textColor: 'default', backgroundColor: 'default', colspan: 1, rowspan: 1 },
      content: Array.isArray(cell) ? cell : cell.content,
    })),
  }))
  return document
}

export async function resizeBoundaryColumn(page: Page, offset: number): Promise<Locator> {
  const table = documentTable(page)
  const cell = table.locator('tr').first().locator('td, th').first()
  await expect(cell).toBeVisible()
  const original = await bounds(cell)
  const start = { x: original.x + original.width - 1, y: original.y + original.height / 2 }
  await page.mouse.move(start.x, start.y)
  await expect(page.getByLabel('Document body', { exact: true })).toHaveClass(/resize-cursor/)
  await expect(table.locator('.column-resize-handle').first()).toBeVisible()
  await page.mouse.down()
  try {
    if (offset > 0) {
      // Exercise direction changes before committing the upper bound. Redundant
      // floating controls used to trigger a WebKit ResizeObserver loop here.
      for (let pass = 0; pass < 4; pass++) {
        await page.mouse.move(start.x + offset, start.y, { steps: 64 })
        await page.mouse.move(start.x + 100, start.y, { steps: 64 })
      }
    }
    await page.mouse.move(start.x + offset, start.y, { steps: 10 })
  }
  finally {
    await page.mouse.up()
  }
  return table
}

async function columnWidth(table: Locator, value: number): Promise<void> {
  const column = table.locator('col').first()
  await expect.poll(async () => await column.evaluate(element => element.style.width)).toBe(`${value}px`)
}

export async function verifyWidthHistoryAndReload(
  page: Page,
  documentId: string,
  before: Table,
  width: number,
): Promise<void> {
  const resized = { ...before, columnWidths: [
    width,
    ...before.columnWidths.slice(1),
  ] }
  await saved(page)
  await columnWidth(documentTable(page), width)
  expect(await persistedTable(page, documentId)).toEqual(resized)
  const toolbar = page.getByRole('toolbar', { name: 'Editor actions', exact: true })
  await toolbar.getByRole('button', { name: 'Undo', exact: true }).click()
  await saved(page)
  await columnWidth(documentTable(page), 120)
  expect(await persistedTable(page, documentId)).toEqual(before)
  await toolbar.getByRole('button', { name: 'Redo', exact: true }).click()
  await saved(page)
  expect(await persistedTable(page, documentId)).toEqual(resized)
  await page.reload()
  await expect(documentTable(page).getByText('First cell', { exact: true })).toBeVisible()
  await columnWidth(documentTable(page), width)
  expect(await persistedTable(page, documentId)).toEqual(resized)
  await expect(page.getByRole('alert')).toHaveCount(0)
}
