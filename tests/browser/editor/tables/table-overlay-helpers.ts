import type { Locator, Page } from '@playwright/test'
import type { Cell, Document, Table } from '@/content/document'
import { expect } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { openDocumentSchema } from '@/contracts/documents'
import { saved } from '~/tests/support/browser/document'
import { withinViewport } from '~/tests/support/browser/layout'

export function cellText(row: number, column: number): string {
  return row === 0 && column === 0 ? 'First cell' : `Row ${row + 1}, column ${column + 1}`
}

export function tableDocument(rows = 2, columns = 2, width = 120): Document {
  const document = emptyDocument()
  document.meta.title = 'Table control polish'
  document.meta.slug = `table-polish-${crypto.randomUUID()}`
  document.blocks.unshift({
    id: crypto.randomUUID(),
    type: 'table',
    props: { textColor: 'default' },
    content: {
      type: 'tableContent',
      columnWidths: Array.from<number>({ length: columns }).fill(width),
      rows: Array.from({ length: rows }, (_, row) => ({
        cells: Array.from({ length: columns }, (_cell, column) => [
          { type: 'text' as const, text: cellText(row, column), styles: {} },
        ]),
      })),
    },
    children: [],
  })
  return document
}

function tableFixtureContent(document: Document): Table {
  const content = document.blocks[0]?.content
  if (content === undefined || Array.isArray(content)) {
    throw new Error('The merged table fixture has no table content')
  }
  return content
}

export function mergedTableDocument(orientation: 'column' | 'row'): Document {
  const document = tableDocument(orientation === 'row' ? 3 : 2, orientation === 'column' ? 3 : 2)
  const content = tableFixtureContent(document)
  for (const row of content.rows) {
    row.cells = row.cells.map(cell => ({
      type: 'tableCell',
      props: { textAlignment: 'left', textColor: 'default', backgroundColor: 'default', colspan: 1, rowspan: 1 },
      content: Array.isArray(cell) ? cell : cell.content,
    }))
  }
  const first = content.rows[0]?.cells[0]
  if (first === undefined || Array.isArray(first)) {
    throw new Error('The merged table fixture has no native first cell')
  }
  if (orientation === 'column') {
    first.props.colspan = 2
    content.rows[0]?.cells.splice(1, 1)
  }
  else {
    first.props.rowspan = 2
    content.rows[1]?.cells.shift()
  }
  return document
}

export function expectMergedInsertion(before: Table, after: Table, orientation: 'column' | 'row'): void {
  expect(after.rows[0]?.cells[0]).toEqual(before.rows[0]?.cells[0])
  if (orientation === 'column') {
    expect(after.columnWidths).toHaveLength(4)
    expect(after.rows).toHaveLength(2)
    expect(after.rows[0]?.cells.map(text)).toEqual([
      'First cell',
      '',
      'Row 1, column 3',
    ])
    expect(after.rows[1]?.cells.map(text)).toEqual([
      'Row 2, column 1',
      'Row 2, column 2',
      '',
      'Row 2, column 3',
    ])
  }
  else {
    expect(after.columnWidths).toEqual(before.columnWidths)
    expect(after.rows).toHaveLength(4)
    expect(after.rows[1]).toEqual(before.rows[1])
    expect(after.rows[2]?.cells.map(text)).toEqual(['', ''])
    expect(after.rows[3]).toEqual(before.rows[2])
  }
}

export async function undoTable(page: Page, documentId: string): Promise<Table> {
  await page.getByRole('toolbar', { name: 'Editor actions', exact: true })
    .getByRole('button', { name: 'Undo', exact: true })
    .click()
  await saved(page)
  return await persistedTable(page, documentId)
}

export function documentTable(page: Page): Locator {
  return page.getByLabel('Document body', { exact: true }).locator('table')
}

export async function revealTable(page: Page): Promise<Locator> {
  const table = documentTable(page)
  await table.getByText('First cell', { exact: true }).hover()
  await expect(page.locator('.editor-table-column-bar')).toBeVisible()
  await expect(page.locator('.editor-table-row-bar')).toBeVisible()
  return table
}

export async function persistedTable(page: Page, documentId: string): Promise<Table> {
  const response = await page.request.get(`/api/admin/documents/${documentId}`)
  expect(response.ok()).toBe(true)
  const snapshot = openDocumentSchema.parse(await response.json())
  const content = snapshot.document.blocks.find(block => block.type === 'table')?.content
  if (content === undefined || Array.isArray(content)) {
    throw new Error('The saved document has no native table content')
  }
  return content
}

export function text(cell: Cell | undefined): string {
  const content = Array.isArray(cell) ? cell : cell?.content ?? []
  return content.map(inline => inline.type === 'text' ? inline.text : '').join('')
}

type Bounds = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>

export async function bounds(locator: Locator): Promise<Bounds> {
  const result = await locator.boundingBox()
  if (result === null) {
    throw new Error('The visible table control has no bounds')
  }
  return result
}

export async function clearOfControls(menu: Locator, controls: Locator): Promise<void> {
  const menuBounds = await bounds(menu)
  const controlBounds = await bounds(controls)
  const side = await menu.getAttribute('data-side')
  expect(['top', 'bottom']).toContain(side)
  if (side === 'top') {
    expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(controlBounds.y + 1)
  }
  else {
    expect(menuBounds.y).toBeGreaterThanOrEqual(controlBounds.y + controlBounds.height - 1)
  }
}

export async function alignedBlockControls(page: Page, group: Locator): Promise<void> {
  const controls = await bounds(group)
  if ((page.viewportSize()?.width ?? 1440) < 701) {
    await mobileBlockControls(page, group, controls)
  }
  else {
    const bar = await bounds(page.locator('.editor-table-column-bar'))
    expect(Math.abs(controls.y + controls.height / 2 - bar.y - bar.height / 2)).toBeLessThanOrEqual(2)
    expect(controls.x + controls.width <= bar.x || controls.x >= bar.x + bar.width).toBe(true)
  }
  await expect(group).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(group).toHaveCSS('border-top-width', '0px')
}

async function mobileBlockControls(page: Page, group: Locator, controls: Bounds): Promise<void> {
  const table = await bounds(documentTable(page))
  const columnBar = await bounds(page.locator('.editor-table-column-bar'))
  expect(controls.y + controls.height).toBeLessThanOrEqual(columnBar.y + 2)
  expect(Math.abs(controls.x + controls.width - table.x - columnBar.width)).toBeLessThanOrEqual(2)
  await expect(group.getByRole('button')).toHaveCount(2)
  for (const button of await group.getByRole('button').all()) {
    const target = await bounds(button)
    expect(target.width).toBeGreaterThanOrEqual(44)
    expect(target.height).toBeGreaterThanOrEqual(44)
  }
  await withinViewport(page, group)
}

export async function expectTableSegments(page: Page, columns: number, rows: number): Promise<void> {
  await expect(page.getByRole('button', { name: /^Column \d+ options$/ })).toHaveCount(columns)
  await expect(page.getByRole('button', { name: /^Row \d+ options$/ })).toHaveCount(rows)
  await expect(page.locator('.editor-table-column-bar')
    .getByRole('button', { name: /^Column \d+ options$/ })).toHaveCount(columns)
  await expect(page.locator('.editor-table-row-bar')
    .getByRole('button', { name: /^Row \d+ options$/ })).toHaveCount(rows)
}

export async function expectTableControlAppearance(page: Page): Promise<void> {
  for (const orientation of ['Column', 'Row'] as const) {
    const button = page.getByRole('button', { name: `${orientation} 1 options`, exact: true })
    const dots = button.locator('svg circle')
    const compact = (page.viewportSize()?.width ?? 1440) < 701
    await expect(dots).toHaveCount(compact ? 6 : 3)
    const centers = await dots.evaluateAll(elements => elements.map((element) => {
      const dotBounds = element.getBoundingClientRect()
      return { x: dotBounds.x + dotBounds.width / 2, y: dotBounds.y + dotBounds.height / 2 }
    }))
    const along = centers.map(center => orientation === 'Column' ? center.x : center.y)
    const across = centers.map(center => orientation === 'Column' ? center.y : center.x)
    expect(Math.max(...along) - Math.min(...along)).toBeGreaterThan(3)
    if (compact) {
      expect(Math.max(...across) - Math.min(...across)).toBeGreaterThan(2)
    }
    else {
      expect(Math.max(...across) - Math.min(...across)).toBeLessThan(1)
    }
    const idleColor = await button.evaluate(element => getComputedStyle(element).color)
    await page.keyboard.press('Tab')
    await button.focus()
    await expect(button).toBeFocused()
    await expect.poll(async () => await button.evaluate(element => getComputedStyle(element).color)).not.toBe(idleColor)
  }
}

export async function expectTouchTableRows(page: Page, rows: number, mobile: boolean): Promise<void> {
  if (!mobile) {
    return
  }
  const buttons = page.locator('.editor-table-row-bar').getByRole('button', { name: /^Row \d+ options$/ })
  await expect(buttons).toHaveCount(rows)
  for (const button of await buttons.all()) {
    const target = await bounds(button)
    expect(target.width).toBeGreaterThanOrEqual(44)
    expect(target.height).toBeGreaterThanOrEqual(44)
  }
}

export async function checkBars(page: Page, table: Locator): Promise<void> {
  const columnBar = page.locator('.editor-table-column-bar')
  const rowBar = page.locator('.editor-table-row-bar')
  const viewport = table.locator('xpath=..')
  await expect(viewport).toHaveClass(/tableWrapper-inner/)
  const tableBounds = await bounds(table)
  const viewportBounds = await bounds(viewport)
  const columnBounds = await bounds(columnBar)
  const rowBounds = await bounds(rowBar)
  expect(Math.abs(columnBounds.x - viewportBounds.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(columnBounds.width - Math.min(tableBounds.width, viewportBounds.width))).toBeLessThanOrEqual(2)
  if ((page.viewportSize()?.width ?? 1440) < 701) {
    expect(Math.abs(columnBounds.y + columnBounds.height - tableBounds.y - 10)).toBeLessThanOrEqual(1)
    const content = table.locator('xpath=ancestor::*[@data-content-type="table"][1]')
    expect(Math.abs((await bounds(content)).width - viewportBounds.width - 8)).toBeLessThanOrEqual(1)
    expect(Math.abs(rowBounds.x + 22 - viewportBounds.x)).toBeLessThanOrEqual(2)
    expect(Math.abs(rowBounds.width - 44)).toBeLessThanOrEqual(2)
    await expect(rowBar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(columnBar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  }
  else {
    expect(columnBounds.y + columnBounds.height).toBeLessThanOrEqual(tableBounds.y + 2)
    expect(rowBounds.x + rowBounds.width).toBeLessThanOrEqual(viewportBounds.x + 2)
  }
  expect(Math.abs(rowBounds.y - tableBounds.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(rowBounds.height - tableBounds.height)).toBeLessThanOrEqual(2)
  for (const bar of [columnBar, rowBar]) {
    expect(await bar.evaluate(element => element.closest('.table-widgets-container') !== null)).toBe(true)
    await withinViewport(page, bar)
  }
}

export async function tableMenu(page: Page, orientation: 'Row' | 'Column', position: number): Promise<Locator> {
  await revealTable(page)
  await page.getByRole('button', { name: `${orientation} ${position} options`, exact: true }).click()
  const menu = page.locator('.bn-table-handle-menu[data-state="open"]')
  await expect(menu).toBeVisible()
  await expect(menu).toHaveCSS('opacity', '1')
  await withinViewport(page, menu)
  return menu
}

export async function tableScrollbar(page: Page, table: Locator): Promise<Locator> {
  const scrollbar = page.getByRole('scrollbar', { name: 'Scroll table horizontally', exact: true })
  await expect(scrollbar).toBeVisible()
  await expect(scrollbar).toHaveAttribute('aria-orientation', 'horizontal')
  const viewport = table.locator('xpath=..')
  const controlledGroup = await viewport.locator('xpath=..').getAttribute('id')
  expect(controlledGroup).not.toBeNull()
  await expect(scrollbar).toHaveAttribute('aria-controls', controlledGroup ?? '')
  expect(await scrollbar.evaluate((element) => {
    const controlled = document.getElementById(element.getAttribute('aria-controls') ?? '')
    const scrollViewport = element.closest('.tableWrapper')?.querySelector('.tableWrapper-inner') ?? null
    return scrollViewport !== null && controlled?.contains(scrollViewport) === true
  })).toBe(true)
  await withinViewport(page, scrollbar)
  const tableBounds = await bounds(table)
  const scrollbarBounds = await bounds(scrollbar)
  expect(scrollbarBounds.y).toBeGreaterThanOrEqual(tableBounds.y + tableBounds.height - 2)
  expect(scrollbarBounds.y).toBeLessThanOrEqual(tableBounds.y + tableBounds.height + 30)
  expect(await scrollbar.evaluate(element => element.closest('.table-widgets-container') !== null)).toBe(true)
  return scrollbar
}
