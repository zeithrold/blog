import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { emptyDocument } from '../../src/content/document'
import { saved, writeDocument } from './helpers'

test('two tabs preserve conflicting content and require a focused explicit replacement dialog', async ({
  page,
  context,
}) => {
  const document = emptyDocument()
  document.meta.title = 'Conflict document'
  document.meta.slug = 'conflict-browser'
  await writeDocument(page, document)
  const second = await context.newPage()
  await second.goto(page.url())
  await expect(second.getByLabel('Document body', { exact: true })).toBeVisible()
  await page.getByLabel('Title', { exact: true }).fill('Server draft title')
  await page.getByLabel('Document body', { exact: true }).fill('First tab server content')
  await saved(page)
  await second.getByLabel('Title', { exact: true }).fill('Local draft title')
  await second
    .getByLabel('Document body', { exact: true })
    .fill('Second tab preserved content')
  await expect(second.getByText('Conflict — draft preserved', { exact: true })).toBeVisible({
    timeout: 15000,
  })
  await expect(second.getByLabel('Document body', { exact: true })).toContainText(
    'Second tab preserved content',
  )
  await second.getByLabel('Document body', { exact: true }).evaluate((element) => {
    element.setAttribute('data-conflict-editor-identity', 'preserved')
  })
  await assertConflictComparison(second)
  await second.getByRole('button', { name: 'Keep local edits', exact: true }).click()
  await second.keyboard.press('Escape')
  await expect(second.getByRole('dialog')).toHaveCount(0)
  await expect(
    second.getByRole('button', { name: 'Keep local edits', exact: true }),
  ).toBeFocused()
  await second.getByRole('button', { name: 'Keep local edits', exact: true }).click()
  await second.getByRole('button', { name: 'Confirm', exact: true }).click()
  await saved(second)
  await expect(second.getByLabel('Document body', { exact: true })).toHaveAttribute(
    'data-conflict-editor-identity',
    'preserved',
  )
  await second.reload()
  await expect(second.getByLabel('Document body', { exact: true })).toContainText(
    'Second tab preserved content',
  )
  await second.close()
})

async function assertConflictComparison(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click()
  const comparison = page.getByRole('region', { name: 'Conflict comparison', exact: true })
  await expect(comparison).toContainText('The baseline is server version')
  const blockChange = comparison.locator('.diff-row[data-change="changed"]')
  await expect(blockChange).toHaveCount(1)
  await blockChange.locator('.diff-block-trigger').click()
  await expect(blockChange.getByText('First tab server content', { exact: true })).toBeVisible()
  await expect(blockChange.getByText('Second tab preserved content', { exact: true })).toBeVisible()
  await comparison.getByText('title', { exact: true }).click()
  await expect(comparison.getByText('Server draft title', { exact: true })).toBeVisible()
  await expect(comparison.getByText('Local draft title', { exact: true })).toBeVisible()
  await page.getByLabel('Title', { exact: true }).fill('Local draft title updated')
  await expect(comparison).toContainText('Local content changed after this comparison')
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click()
  await comparison.getByText('title', { exact: true }).click()
  await expect(comparison.getByText('Local draft title updated', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Document body', { exact: true })).toHaveAttribute(
    'data-conflict-editor-identity',
    'preserved',
  )
}
