import type { Locator, Page } from '@playwright/test'
import type { ApiService } from '../support/http-fixtures'
import type { Document } from '@/content/document'
import {
  keyboardTableDocument,
  tableWidgets,
} from '~/tests/browser/editor/tables/table-keyboard-helpers'
import { bounds, documentTable } from '~/tests/browser/editor/tables/table-overlay-helpers'
import { settingsTab } from '~/tests/support/browser/settings'
import {
  mountTableWorkspace,
  revisionCount,
  savedDocument,
} from '../support/editor-table-fixtures'
import { expect, test } from '../support/test'

/**
 * Table caption cases on the production editor entry. A caption is document
 * metadata, so the case asserts the accessibility block of the revision packet
 * and that the table blocks are untouched; the stored copy and the real reload
 * stay with the retained compact case.
 */

/**
 * Saves the caption a case just committed and returns the written body. The
 * caption commits on Enter or blur, so the count is read before the button
 * opens the field.
 */
async function editCaption(
  page: Page,
  api: ApiService,
  table: Locator,
  value: string,
): Promise<Document> {
  const before = revisionCount(api)
  await tableWidgets(table).locator('.editor-table-caption button').click()
  const input = tableWidgets(table).getByRole('textbox', { name: 'Table caption', exact: true })
  await expect(input).toBeFocused()
  await input.fill(value)
  await input.press('Enter')
  await expect(tableWidgets(table).locator('.editor-table-caption button')).toBeFocused()
  return await savedDocument(page, api, before)
}

test('each table has an independent caption below its viewport at 1440px', async ({ page }) => {
  const body = keyboardTableDocument(false)
  const [firstId, secondId] = body.blocks.filter(block => block.type === 'table').map(block => block.id)
  if (firstId === undefined || secondId === undefined) {
    throw new Error('The caption fixture needs two tables')
  }
  const { api, open } = await mountTableWorkspace(page, body)
  try {
    const tables = documentTable(page)
    await expect(tables).toHaveCount(2)
    const first = tables.nth(0)
    const second = tables.nth(1)
    await expect(page.getByRole('button', { name: 'Add caption', exact: true })).toHaveCount(2)
    for (const table of [first, second]) {
      const caption = tableWidgets(table).locator('.editor-table-caption')
      const tableBounds = await bounds(table)
      const captionBounds = await bounds(caption)
      expect(captionBounds.y).toBeGreaterThanOrEqual(tableBounds.y + tableBounds.height)
      expect(captionBounds.x).toBeGreaterThanOrEqual(0)
      expect(captionBounds.x + captionBounds.width).toBeLessThanOrEqual(1440)
    }
    const firstCaption = '第一张表：季度收入'
    const secondCaption = '第二张表：成本比较'
    const afterFirst = await editCaption(page, api, first, firstCaption)
    expect(afterFirst.blocks).toEqual(open.blocks)
    expect(afterFirst.tableAccessibility).toEqual({ [firstId]: { caption: firstCaption } })
    const afterBoth = await editCaption(page, api, second, secondCaption)
    expect(afterBoth.blocks).toEqual(open.blocks)
    expect(afterBoth.tableAccessibility).toEqual({
      [firstId]: { caption: firstCaption },
      [secondId]: { caption: secondCaption },
    })
    await expect(tableWidgets(first).getByRole('button', {
      name: `Edit table caption: ${firstCaption}`,
      exact: true,
    })).toBeVisible()
    await expect(tableWidgets(second).getByRole('button', {
      name: `Edit table caption: ${secondCaption}`,
      exact: true,
    })).toBeVisible()
    const cleared = await editCaption(page, api, first, '')
    await expect(tableWidgets(first).getByRole('button', { name: 'Add caption', exact: true })).toBeVisible()
    expect(cleared.tableAccessibility[secondId]).toEqual({ caption: secondCaption })
    expect(cleared.tableAccessibility[firstId]?.caption ?? '').toBe('')
    await settingsTab(page, 'Content')
    await expect(page.getByRole('tab', { name: 'Media', exact: true })).toHaveCount(0)
    await expect(page.getByRole('tabpanel', { name: 'Content', exact: true }).getByRole('textbox', {
      name: 'Table caption',
      exact: true,
    })).toHaveCount(0)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('Chinese caption controls focus the input and close on blur or Escape', async ({ page }, info) => {
  const { api } = await mountTableWorkspace(page, keyboardTableDocument(false), 1440, 'zh')
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
    await expect(caption.getByRole('button', { name: '编辑表格标题：修改后的标题', exact: true })).toBeVisible()
    const saved = await savedDocument(page, api, before)
    expect(Object.values(saved.tableAccessibility).map(entry => entry.caption)).toContain('修改后的标题')
    await page.screenshot({ path: info.outputPath('table-caption-zh.png'), fullPage: true })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
