import {
  enterColumnControl,
  escapeToCell,
  keyboardTableDocument,
  openFocusedTableMenu,
  pressCellTabs,
  startInCell,
  tableCaret,
  tableWidgets,
  tabToRowControl,
} from '~/tests/browser/editor/tables/table-keyboard-helpers'
import { documentTable, tableDocument, text } from '~/tests/browser/editor/tables/table-overlay-helpers'
import { horizontalBounds, withinViewport } from '~/tests/support/browser/layout'
import {
  mountTableWorkspace,
  mountTableWorkspaceWithWrites,
  revisionCount,
  savedDocument,
  savedTable,
  tableOfId,
} from '../support/editor-table-fixtures'
import { defer, failure } from '../support/http-fixtures'
import { expect, test } from '../support/test'

/**
 * Native keyboard, selection and formatting behavior on the production editor
 * entry. Navigation is not an edit, so those cases assert that no revision went
 * out; the cases that edit assert the packet the editor sent.
 */

for (const width of [1440, 320]) {
  test(`cell keys reach the current table column and row controls at ${width}px`, async ({ page }, info) => {
    const { api } = await mountTableWorkspace(page, keyboardTableDocument(false), width)
    try {
      const body = page.getByLabel('Document body', { exact: true })
      const tables = documentTable(page)
      await expect(tables).toHaveCount(2)
      const first = tables.nth(0)
      const second = tables.nth(1)
      await startInCell(page, first, 'First cell')
      await pressCellTabs(page, 1)
      expect((await tableCaret(page)).cell).toBe('Row 1, column 2')
      await expect(body).toBeFocused()
      await pressCellTabs(page, -1)
      expect((await tableCaret(page)).cell).toBe('First cell')
      await startInCell(page, second, 'Second First cell')
      await pressCellTabs(page, 4)
      expect((await tableCaret(page)).cell).toBe('Second Row 2, column 2')
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowRight')
      const caret = await tableCaret(page)
      expect(caret.cell).toMatch(/^Second Row 2, column [23]$/)
      expect(caret.collapsed).toBe(true)
      const columnLabel = caret.cell?.endsWith('3') === true ? 'Column 3 options' : 'Column 2 options'
      await enterColumnControl(page, second, columnLabel)
      const menu = await openFocusedTableMenu(page, 'Add column left')
      await horizontalBounds(page, menu)
      await page.screenshot({ path: info.outputPath(`keyboard-table-menu-${width}.png`) })
      await escapeToCell(page, caret)
      await enterColumnControl(page, second, columnLabel)
      await escapeToCell(page, caret)
      await enterColumnControl(page, second, columnLabel)
      const rowControl = await tabToRowControl(page, second, width === 320 ? 'Row 2 options' : 'Row 1 options')
      await horizontalBounds(page, rowControl)
      const rowMenu = await openFocusedTableMenu(page, 'Add row above')
      await horizontalBounds(page, rowMenu)
      await escapeToCell(page, caret)
      // Navigation and menus are not edits; the whole session must send no write.
      expect(revisionCount(api)).toBe(0)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('keyboard column insertion saves one revision and Undo restores the table', async ({ page }) => {
  const body = keyboardTableDocument(false)
  const secondId = body.blocks[1]?.id
  if (secondId === undefined) {
    throw new Error('The keyboard fixture has no second table')
  }
  const { api, open } = await mountTableWorkspace(page, body)
  try {
    const second = documentTable(page).nth(1)
    await startInCell(page, second, 'Second First cell')
    await pressCellTabs(page, 4)
    await enterColumnControl(page, second, 'Column 2 options')
    const menu = await openFocusedTableMenu(page, 'Add column left')
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem', { name: 'Add column right', exact: true })).toBeFocused()
    const before = revisionCount(api)
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Document body', { exact: true })).toBeFocused()
    await expect(second.locator('tr').first().locator('td, th')).toHaveCount(4)
    const after = await savedDocument(page, api, before)
    expect(after.blocks[0]).toEqual(open.blocks[0])
    expect(tableOfId(after, secondId).rows.map(row => row.cells.map(text))).toEqual([
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
    const undoBefore = revisionCount(api)
    await page.keyboard.press('ControlOrMeta+z')
    const restored = await savedDocument(page, api, undoBefore)
    expect(restored).toEqual(open)
    await expect(second.locator('tr').first().locator('td, th')).toHaveCount(3)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('pending operations reject the table control shortcut in the read-only editor', async ({ page }) => {
  const publish = defer()
  const { api } = await mountTableWorkspaceWithWrites(page, keyboardTableDocument(false), {
    width: 320,
    writes: {
      // The refusal is the case's own boundary: the publish request is held so
      // the editor stays busy, then answered as a failed Worker request.
      'POST /api/admin/documents/:id/publish': async () => {
        await publish.promise
        return failure(503, 'QA_REQUEST_NOT_EXECUTED')
      },
    },
  })
  try {
    const body = page.getByLabel('Document body', { exact: true })
    const second = documentTable(page).nth(1)
    await startInCell(page, second, 'Second First cell')
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect.poll(() => api.calls.some(call => call.method === 'POST' && call.path.endsWith('/publish')))
      .toBe(true)
    await expect(body).toHaveAttribute('contenteditable', 'false')
    await body.focus()
    await page.keyboard.press('Alt+F10')
    await expect(tableWidgets(second).locator('[data-table-control-column]').first()).not.toBeFocused()
    await expect(page.locator('.bn-table-handle-menu[data-state="open"]')).toHaveCount(0)
    expect(revisionCount(api)).toBe(0)
  }
  finally {
    publish.open()
    await expect(page.getByLabel('Document body', { exact: true })).toHaveAttribute('contenteditable', 'true')
    await api.expectServed()
    await api.dispose()
  }
})

test('table formatting preserves its range below the selection at 1440px', async ({ page }, info) => {
  const { api } = await mountTableWorkspace(page, tableDocument())
  try {
    const body = page.getByLabel('Document body', { exact: true })
    await body.focus()
    const cell = body.getByRole('cell').first()
    await cell.evaluate(element => element.scrollIntoView({ block: 'center' }))
    await cell.evaluate(async (element) => {
      await document.fonts.ready
      const node = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()
      if (node === null) {
        throw new Error('The table fixture needs cell text')
      }
      window.getSelection()?.setBaseAndExtent(node, 0, node, 5)
      document.dispatchEvent(new Event('selectionchange'))
    })
    await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString())).toBe('First')
    const bar = page.getByRole('toolbar', { name: 'Formatting', exact: true })
    await expect(bar).toBeVisible()
    await expect(bar.locator('..')).toHaveCSS('opacity', '1')
    await withinViewport(page, bar)
    await expect.poll(async () => await bar.evaluate((element) => {
      const selection = window.getSelection()
      if (selection === null || selection.rangeCount === 0) {
        return -1
      }
      return element.getBoundingClientRect().top - selection.getRangeAt(0).getBoundingClientRect().bottom
    })).toBeGreaterThanOrEqual(7)
    const before = revisionCount(api)
    await bar.getByRole('button', { name: 'Italic', exact: true }).click()
    const savedCell = (await savedTable(page, api, before)).rows[0]?.cells[0]
    expect(Array.isArray(savedCell) ? savedCell : savedCell?.content).toEqual([
      { type: 'text', text: 'First', styles: { italic: true } },
      { type: 'text', text: ' cell', styles: {} },
    ])
    await expect(body.getByRole('cell').first().locator('em')).toHaveText('First')
    await expect(body.getByRole('cell').nth(1)).toHaveText('Row 1, column 2')
    await page.screenshot({ path: info.outputPath('formatting-table-1440.png') })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
