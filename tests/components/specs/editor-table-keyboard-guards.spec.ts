import {
  keyboardTableDocument,
  pressCellTabs,
  startInCell,
  tableCaret,
} from '~/tests/browser/editor/tables/table-keyboard-helpers'
import { documentTable } from '~/tests/browser/editor/tables/table-overlay-helpers'
import {
  mountTableWorkspace,
  revisionCount,
} from '../support/editor-table-fixtures'
import { expect, test } from '../support/test'

/**
 * Keyboard guards and localized help on the production editor entry. These
 * cases read focus, the caret and the help copy; no edit may reach a revision.
 */

test('composition keeps Alt+F10 in the native cell without changing the document', async ({ page }) => {
  const { api } = await mountTableWorkspace(page, keyboardTableDocument(false), 320)
  try {
    const body = page.getByLabel('Document body', { exact: true })
    const second = documentTable(page).nth(1)
    await startInCell(page, second, 'Second First cell')
    await pressCellTabs(page, 1)
    const caret = await tableCaret(page)
    await body.dispatchEvent('compositionstart')
    try {
      await page.keyboard.press('Alt+F10')
      await expect(body).toBeFocused()
      expect(await tableCaret(page)).toEqual(caret)
      await expect(page.locator('.bn-table-handle-menu[data-state="open"]')).toHaveCount(0)
    }
    finally {
      await body.dispatchEvent('compositionend')
    }
    expect(revisionCount(api)).toBe(0)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

for (const locale of ['en', 'zh'] as const) {
  test(`desktop keyboard help follows the hovered table block in ${locale}`, async ({ page }) => {
    const help = locale === 'en'
      ? 'In a table cell, Alt+F10 focuses column options. Tab reaches row options; Escape returns to the cell.'
      : '在表格单元格中，按 Alt+F10 进入列选项。按 Tab 可前往行选项，按 Escape 返回原单元格。'
    const { api } = await mountTableWorkspace(page, keyboardTableDocument(false), 1440, locale)
    try {
      const body = page.getByLabel(locale === 'en' ? 'Document body' : '正文', { exact: true })
      const table = body.locator('table').first()
      await table.evaluate(element => element.scrollIntoView({ block: 'center' }))
      await body.getByText('First cell', { exact: true }).hover()
      await expect(page.locator('.editor-side')).toHaveAttribute('data-block-type', 'table')
      const id = await table.evaluate(element => element.closest('[data-id]')?.getAttribute('data-id'))
      await page.getByRole('button', { name: locale === 'en' ? 'Open block menu' : '打开菜单', exact: true }).click()
      await expect(page.locator('.editor-block-action-list')).toHaveAttribute('data-block-id', id ?? '')
      const keyboardHelp = page.getByText(help, { exact: true })
      await expect(keyboardHelp).toBeVisible()
      await expect(keyboardHelp).toHaveCSS('display', 'block')
      expect(revisionCount(api)).toBe(0)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
