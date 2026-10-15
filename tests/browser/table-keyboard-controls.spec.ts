import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { saved } from './helpers'
import { horizontalBounds, setLocale } from './preview-history-helpers'
import {
  enterColumnControl,
  escapeToCell,
  keyboardTableFixture,
  openFocusedTableMenu,
  persistedKeyboardDocument,
  pressCellTabs,
  startInCell,
  tableCaret,
  tableWidgets,
  tabToRowControl,
} from './table-keyboard-helpers'
import { text } from './table-overlay-helpers'

const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([])
})

for (const width of [1440, 320]) {
  test(`real cell keys reach the current table column and row controls at ${width}px`, async ({ page }, info) => {
    const fixture = await keyboardTableFixture(page, width)
    const before = await persistedKeyboardDocument(page, fixture.id)
    await startInCell(page, fixture.first, 'First cell')
    await pressCellTabs(page, 1)
    expect((await tableCaret(page)).cell).toBe('Row 1, column 2')
    await expect(fixture.body).toBeFocused()
    await pressCellTabs(page, -1)
    expect((await tableCaret(page)).cell).toBe('First cell')
    await startInCell(page, fixture.second, 'Second First cell')
    await pressCellTabs(page, 4)
    expect((await tableCaret(page)).cell).toBe('Second Row 2, column 2')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    const caret = await tableCaret(page)
    expect(caret.cell).toMatch(/^Second Row 2, column [23]$/)
    expect(caret.collapsed).toBe(true)
    const columnLabel = caret.cell?.endsWith('3') === true ? 'Column 3 options' : 'Column 2 options'
    await enterColumnControl(page, fixture.second, columnLabel)
    const menu = await openFocusedTableMenu(page, 'Add column left')
    await horizontalBounds(page, menu)
    await page.screenshot({ path: info.outputPath(`keyboard-table-menu-${width}.png`) })
    await escapeToCell(page, caret)
    await enterColumnControl(page, fixture.second, columnLabel)
    await escapeToCell(page, caret)
    await enterColumnControl(page, fixture.second, columnLabel)
    const rowControl = await tabToRowControl(page, fixture.second, width === 320 ? 'Row 2 options' : 'Row 1 options')
    await horizontalBounds(page, rowControl)
    const rowMenu = await openFocusedTableMenu(page, 'Add row above')
    await horizontalBounds(page, rowMenu)
    await escapeToCell(page, caret)
    expect(await persistedKeyboardDocument(page, fixture.id)).toEqual(before)
  })

  test(`current lower-row cells map to merged column controls at ${width}px`, async ({ page }) => {
    const fixture = await keyboardTableFixture(page, width, true)
    const before = await persistedKeyboardDocument(page, fixture.id)
    await startInCell(page, fixture.second, 'Second First cell')
    await pressCellTabs(page, 3)
    expect((await tableCaret(page)).cell).toBe('Second Row 2, column 2')
    let caret = await tableCaret(page)
    await enterColumnControl(page, fixture.second, 'Columns 1–2 options')
    await escapeToCell(page, caret)
    await pressCellTabs(page, 1)
    expect((await tableCaret(page)).cell).toBe('Second Row 2, column 3')
    caret = await tableCaret(page)
    await enterColumnControl(page, fixture.second, 'Column 3 options')
    await openFocusedTableMenu(page, 'Add column left')
    await escapeToCell(page, caret)
    expect(await persistedKeyboardDocument(page, fixture.id)).toEqual(before)
  })
}

test('keyboard column operations use native save and one Undo in the current table', async ({ page }) => {
  const fixture = await keyboardTableFixture(page, 1440)
  const before = await persistedKeyboardDocument(page, fixture.id)
  await startInCell(page, fixture.second, 'Second First cell')
  await pressCellTabs(page, 4)
  await enterColumnControl(page, fixture.second, 'Column 2 options')
  const menu = await openFocusedTableMenu(page, 'Add column left')
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem', { name: 'Add column right', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(fixture.body).toBeFocused()
  await expect(fixture.second.locator('tr').first().locator('td,th')).toHaveCount(4)
  await saved(page)
  const after = await persistedKeyboardDocument(page, fixture.id)
  expect(after.document.blocks[0]).toEqual(before.document.blocks[0])
  const content = after.document.blocks[1]?.content
  expect(content !== undefined && !Array.isArray(content) && content.rows.map(row => row.cells.map(text))).toEqual([
    [
      'Second First cell',
      'Second Row 1, column 2',
      '',
      'Second Row 1, column 3',
    ],
    [
      'Second Row 2, column 1',
      'Second Row 2, column 2',
      '',
      'Second Row 2, column 3',
    ],
  ])
  await page.keyboard.press('ControlOrMeta+z')
  await saved(page)
  expect((await persistedKeyboardDocument(page, fixture.id)).document).toEqual(before.document)
  await page.reload()
  await expect(fixture.second.locator('tr').first().locator('td,th')).toHaveCount(3)
  expect((await persistedKeyboardDocument(page, fixture.id)).document).toEqual(before.document)
})

test('composition keeps Alt+F10 in the native cell without changing the document', async ({ page }) => {
  const fixture = await keyboardTableFixture(page, 320)
  const before = await persistedKeyboardDocument(page, fixture.id)
  await startInCell(page, fixture.second, 'Second First cell')
  await pressCellTabs(page, 1)
  const caret = await tableCaret(page)
  await fixture.body.dispatchEvent('compositionstart')
  try {
    await page.keyboard.press('Alt+F10')
    await expect(fixture.body).toBeFocused()
    expect(await tableCaret(page)).toEqual(caret)
    await expect(page.locator('.bn-table-handle-menu[data-state="open"]')).toHaveCount(0)
  }
  finally {
    await fixture.body.dispatchEvent('compositionend')
  }
  expect(await persistedKeyboardDocument(page, fixture.id)).toEqual(before)
})

test('pending operations reject the table control shortcut in the read-only editor', async ({ page }) => {
  const fixture = await keyboardTableFixture(page, 320)
  const before = await persistedKeyboardDocument(page, fixture.id)
  await startInCell(page, fixture.second, 'Second First cell')
  let release: (() => void) | undefined
  let intercepted = false
  const hold = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/admin/documents/*/publish', async (route) => {
    intercepted = true
    await hold
    await route.fulfill({ status: 503, json: { error: { code: 'QA_REQUEST_NOT_EXECUTED' } } })
  })
  try {
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect.poll(() => intercepted).toBe(true)
    await expect(fixture.body).toHaveAttribute('contenteditable', 'false')
    await fixture.body.focus()
    await page.keyboard.press('Alt+F10')
    await expect(tableWidgets(fixture.second).locator('[data-table-control-column]').first()).not.toBeFocused()
    await expect(page.locator('.bn-table-handle-menu[data-state="open"]')).toHaveCount(0)
    expect(await persistedKeyboardDocument(page, fixture.id)).toEqual(before)
  }
  finally {
    release?.()
    await expect(fixture.body).toHaveAttribute('contenteditable', 'true')
    await page.unroute('**/api/admin/documents/*/publish')
  }
})

for (const locale of ['en', 'zh'] as const) {
  test(`desktop table keyboard help is discoverable in ${locale}`, async ({ page }) => {
    await keyboardTableFixture(page, 1440)
    await setLocale(page, locale)
    const help = locale === 'en'
      ? 'In a table cell, Alt+F10 focuses column options. Tab reaches row options; Escape returns to the cell.'
      : '在表格单元格中，按 Alt+F10 进入列选项。按 Tab 可前往行选项，按 Escape 返回原单元格。'
    const body = page.getByLabel(locale === 'en' ? 'Document body' : '正文', { exact: true })
    await body.locator('table').first().evaluate(element => element.scrollIntoView({ block: 'center' }))
    await body.getByText('First cell', { exact: true }).hover()
    await expect(page.locator('.editor-side')).toHaveAttribute('data-block-type', 'table')
    const id = await body.locator('table').first().evaluate(element =>
      element.closest('[data-id]')?.getAttribute('data-id'))
    if (locale === 'en') {
      await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
    }
    else {
      await page.getByRole('button', { name: '打开菜单', exact: true }).click()
    }
    await expect(page.locator('.editor-block-action-list')).toHaveAttribute('data-block-id', id ?? '')
    await expect(page.getByText(help, { exact: true })).toBeVisible()
  })
}
