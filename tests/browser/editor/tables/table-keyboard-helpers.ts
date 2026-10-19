import type { Locator, Page } from '@playwright/test'
import type { Document } from '@/content/document'
import { expect } from '@playwright/test'
import { openDocumentSchema } from '@/contracts/documents'
import { writeDocument } from '~/tests/support/browser/document'
import { documentTable, mergedTableDocument } from './table-overlay-helpers'
import { widthBoundaryDocument } from './table-width-limits-helpers'

export type TableCaret = {
  tableId: string | null
  cell: string | null
  offset: number
  anchorOffset: number
  selectedText: string
  collapsed: boolean
}

function twoTableDocument(merged: boolean): Document {
  const document = merged ? mergedTableDocument('column') : widthBoundaryDocument()
  document.meta.title = 'Pure keyboard table controls'
  const first = document.blocks[0]
  if (first?.type !== 'table') {
    throw new Error('The keyboard fixture has no native table')
  }
  const second = structuredClone(first)
  second.id = crypto.randomUUID()
  const content = second.content
  if (content === undefined || Array.isArray(content)) {
    throw new Error('The second keyboard table has no cells')
  }
  content.rows.forEach((row) => {
    row.cells.forEach((cell) => {
      const inline = Array.isArray(cell) ? cell : cell.content
      inline.forEach((item) => {
        if (item.type === 'text') {
          item.text = `Second ${item.text}`
        }
      })
    })
  })
  document.blocks.splice(1, 0, second)
  return document
}

export async function keyboardTableFixture(
  page: Page,
  width: number,
  merged = false,
): Promise<{ id: string, body: Locator, first: Locator, second: Locator }> {
  await page.setViewportSize({ width, height: 1000 })
  const acknowledgement = await writeDocument(page, twoTableDocument(merged))
  const body = page.getByLabel('Document body', { exact: true })
  const tables = documentTable(page)
  await expect(tables).toHaveCount(2)
  return { id: acknowledgement.documentId, body, first: tables.nth(0), second: tables.nth(1) }
}

export async function startInCell(page: Page, table: Locator, text: string): Promise<void> {
  await table.getByText(text, { exact: true }).click()
  await page.keyboard.press('Home')
  await page.mouse.move(1, 1)
  await expect(page.getByLabel('Document body', { exact: true })).toBeFocused()
}

export async function tableCaret(page: Page): Promise<TableCaret> {
  return await page.evaluate(() => {
    const selection = window.getSelection()
    if (selection === null || selection.focusNode === null) {
      return { tableId: null, cell: null, offset: -1, anchorOffset: -1, selectedText: '', collapsed: true }
    }
    const detail = {
      offset: selection.focusOffset,
      anchorOffset: selection.anchorOffset,
      selectedText: selection.toString(),
      collapsed: selection.isCollapsed,
    }
    const node = selection.focusNode
    const element = node instanceof Element ? node : node.parentElement
    const cell = element?.closest('td,th') ?? null
    if (cell === null) {
      return { tableId: null, cell: null, ...detail }
    }
    return {
      tableId: cell.closest('[data-id]')?.getAttribute('data-id') ?? null,
      cell: cell.textContent,
      ...detail,
    }
  })
}

export async function pressCellTabs(page: Page, count: number): Promise<void> {
  for (let index = 0; index < Math.abs(count); index++) {
    await page.keyboard.press(count < 0 ? 'Shift+Tab' : 'Tab')
  }
}

export function tableWidgets(table: Locator): Locator {
  return table.locator('xpath=ancestor::*[@data-node-type="blockOuter"][1]')
}

export async function enterColumnControl(page: Page, table: Locator, label: string): Promise<Locator> {
  await page.keyboard.press('Alt+F10')
  const control = tableWidgets(table).getByRole('button', { name: label, exact: true })
  await expect(control).toBeFocused()
  await expect(control).toHaveAttribute('aria-keyshortcuts', 'Alt+F10')
  await expect(tableWidgets(table).locator('.editor-table-column-bar')).toHaveCSS('opacity', '1')
  return control
}

export async function openFocusedTableMenu(page: Page, item: string): Promise<Locator> {
  await page.keyboard.press('ArrowDown')
  const menu = page.locator('.bn-table-handle-menu[data-state="open"]')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: item, exact: true })).toBeFocused()
  return menu
}

export async function escapeToCell(page: Page, caret: TableCaret): Promise<void> {
  await page.keyboard.press('Escape')
  await expect(page.locator('.bn-table-handle-menu[data-state="open"]')).toHaveCount(0)
  await expect(page.getByLabel('Document body', { exact: true })).toBeFocused()
  await expect.poll(async () => await tableCaret(page)).toEqual(caret)
}

export async function tabToRowControl(page: Page, table: Locator, label = 'Row 1 options'): Promise<Locator> {
  const control = tableWidgets(table).getByRole('button', { name: label, exact: true })
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab')
    if (await control.evaluate(element => element === document.activeElement)) {
      break
    }
  }
  await expect(control).toBeFocused()
  return control
}

export async function persistedKeyboardDocument(
  page: Page,
  id: string,
): Promise<ReturnType<typeof openDocumentSchema.parse>> {
  const response = await page.request.get(`/api/admin/documents/${id}`)
  expect(response.ok()).toBe(true)
  return openDocumentSchema.parse(await response.json())
}
