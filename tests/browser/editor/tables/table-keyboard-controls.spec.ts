import type { Page } from '@playwright/test'
import { setLocale } from '~/tests/support/browser/locale'
import { expect, test } from '~/tests/support/browser/test'
import {
  enterColumnControl,
  escapeToCell,
  keyboardTableFixture,
  openFocusedTableMenu,
  persistedKeyboardDocument,
  pressCellTabs,
  startInCell,
  tableCaret,
} from './table-keyboard-helpers'

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
