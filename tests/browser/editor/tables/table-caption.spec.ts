import type { Locator, Page } from '@playwright/test'
import { saved } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'
import { keyboardTableFixture, persistedKeyboardDocument, tableWidgets } from './table-keyboard-helpers'
import { bounds } from './table-overlay-helpers'

const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([])
})

async function editCaption(page: Page, table: Locator, value: string): Promise<void> {
  await tableWidgets(table).locator('.editor-table-caption button').click()
  const input = tableWidgets(table).getByRole('textbox', { name: 'Table caption', exact: true })
  await expect(input).toBeFocused()
  await input.fill(value)
  await input.press('Enter')
  await expect(tableWidgets(table).locator('.editor-table-caption button')).toBeFocused()
  await saved(page)
}

for (const width of [390]) {
  test(`each table has an independent caption below its viewport at ${width}px`, async ({ page }) => {
    const fixture = await keyboardTableFixture(page, width)
    const before = await persistedKeyboardDocument(page, fixture.id)
    await expect(fixture.body.getByRole('button', { name: 'Add caption', exact: true })).toHaveCount(2)
    for (const table of [fixture.first, fixture.second]) {
      const caption = tableWidgets(table).locator('.editor-table-caption')
      const tableBounds = await bounds(table)
      const captionBounds = await bounds(caption)
      expect(captionBounds.y).toBeGreaterThanOrEqual(tableBounds.y + tableBounds.height)
      expect(captionBounds.x).toBeGreaterThanOrEqual(0)
      expect(captionBounds.x + captionBounds.width).toBeLessThanOrEqual(width)
    }
    await editCaption(page, fixture.first, '第一张表：季度收入')
    await editCaption(page, fixture.second, '第二张表：成本比较')
    const after = await persistedKeyboardDocument(page, fixture.id)
    expect(after.document.blocks).toEqual(before.document.blocks)
    const [firstId = '', secondId = ''] = after.document.blocks.filter(block => block.type === 'table')
      .map(block => block.id)
    expect(after.document.tableAccessibility).toEqual({
      [firstId]: { caption: '第一张表：季度收入' },
      [secondId]: { caption: '第二张表：成本比较' },
    })
    await page.reload()
    await expect(tableWidgets(fixture.first).getByRole('button', {
      name: 'Edit table caption: 第一张表：季度收入',
      exact: true,
    })).toBeVisible()
    await expect(tableWidgets(fixture.second).getByRole('button', {
      name: 'Edit table caption: 第二张表：成本比较',
      exact: true,
    })).toBeVisible()
    await editCaption(page, fixture.first, '')
    await expect(tableWidgets(fixture.first).getByRole('button', { name: 'Add caption', exact: true })).toBeVisible()
    expect((await persistedKeyboardDocument(page, fixture.id)).document.tableAccessibility[secondId])
      .toEqual({ caption: '第二张表：成本比较' })
    await settingsTab(page, 'Content')
    await expect(page.getByRole('tab', { name: 'Media', exact: true })).toHaveCount(0)
    await expect(page.getByRole('tabpanel', { name: 'Content', exact: true }).getByRole('textbox', {
      name: 'Table caption',
      exact: true,
    })).toHaveCount(0)
  })
}
