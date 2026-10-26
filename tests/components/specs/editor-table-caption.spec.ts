import {
  keyboardTableDocument,
  tableWidgets,
} from '~/tests/browser/editor/tables/table-keyboard-helpers'
import { bounds, documentTable } from '~/tests/browser/editor/tables/table-overlay-helpers'
import { mountTableWorkspace, revisionCount, savedDocument } from '../support/editor-table-fixtures'
import { expect, test } from '../support/test'

/** Caption data runs in jsdom; live table geometry and focus/blur remain browser cases. */

/*
 * The title is the retained historical registration identity, not a claim about
 * current scope. This case now proves 1440px geometry only: jsdom proves the
 * independent caption entries, the revision packet and the cleared caption, so
 * the wider title is known naming debt rather than coverage.
 */
test('each table has an independent caption below its viewport at 1440px', async ({ page }) => {
  const body = keyboardTableDocument(false)
  const { api } = await mountTableWorkspace(page, body)
  try {
    const tables = documentTable(page)
    await expect(tables).toHaveCount(2)
    const first = tables.nth(0)
    const second = tables.nth(1)
    for (const table of [first, second]) {
      const caption = tableWidgets(table).locator('.editor-table-caption')
      const tableBounds = await bounds(table)
      const captionBounds = await bounds(caption)
      expect(captionBounds.y).toBeGreaterThanOrEqual(tableBounds.y + tableBounds.height)
      expect(captionBounds.x).toBeGreaterThanOrEqual(0)
      expect(captionBounds.x + captionBounds.width).toBeLessThanOrEqual(1440)
    }
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('Chinese caption controls focus the input and close on blur or Escape', async ({ page }) => {
  const body = keyboardTableDocument(false)
  const firstId = body.blocks.find(block => block.type === 'table')?.id
  if (firstId === undefined) {
    throw new Error('The caption fixture has no first table')
  }
  const { api, open } = await mountTableWorkspace(page, body, 1440, 'zh')
  const before = revisionCount(api)
  try {
    const tables = page.getByLabel('正文', { exact: true }).locator('table')
    const caption = tableWidgets(tables.first()).locator('.editor-table-caption')
    await caption.getByRole('button', { name: '添加标题', exact: true }).click()
    const input = caption.getByRole('textbox', { name: '表格标题', exact: true })
    await expect(input).toBeFocused()
    await expect(input).toHaveAttribute('placeholder', '填写这个表格的标题')
    await input.fill('表一标题')
    await input.press('Escape')
    const button = caption.getByRole('button', { name: '编辑表格标题：表一标题', exact: true })
    await expect(button).toBeFocused()

    await button.click()
    await input.fill('修改后的标题')
    await tables.nth(1).getByText('Second First cell', { exact: true }).click()
    await expect(caption.getByRole('textbox')).toHaveCount(0)
    await expect(caption.getByRole('button', { name: '编辑表格标题：修改后的标题', exact: true }))
      .toBeVisible()

    const saved = await savedDocument(page, api, before)
    expect(saved.blocks).toEqual(open.blocks)
    expect(saved.tableAccessibility[firstId]).toEqual({ caption: '修改后的标题' })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
