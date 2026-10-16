import type { Page } from '@playwright/test'
import type { CatalogItem } from '@/features/catalog/catalog-controller'
import { openDocumentSchema, sessionSchema } from '@/content/contracts'
import { emptyDocument } from '@/content/empty'
import { catalogItemSchema } from '@/content/service-contracts'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'

async function createEntry(page: Page, kind: 'tag' | 'series', name: string, retired = false): Promise<CatalogItem> {
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  const headers = {
    'origin': new URL(page.url()).origin,
    'x-csrf-token': session.csrfToken,
    'idempotency-key': crypto.randomUUID(),
  }
  const response = await page.request.post(`/api/admin/catalog/${kind}`, {
    data: { name, slug: `${kind}-${crypto.randomUUID()}` },
    headers,
  })
  expect(response.ok()).toBe(true)
  const entry = catalogItemSchema.parse(await response.json())
  if (retired) {
    const result = await page.request.put(`/api/admin/catalog/${kind}/${entry.id}`, {
      data: { slug: entry.slug, name, retired: true, expectedVersion: entry.version },
      headers: { ...headers, 'idempotency-key': crypto.randomUUID() },
    })
    expect(result.ok()).toBe(true)
    return catalogItemSchema.parse(await result.json())
  }
  return entry
}

async function readMeta(page: Page): Promise<ReturnType<typeof openDocumentSchema.parse>['document']['meta']> {
  const path = new URL(page.url()).pathname.replace('/admin/documents/', '/api/admin/documents/')
  return openDocumentSchema.parse(await (await page.request.get(path)).json()).document.meta
}

async function fresh(page: Page): Promise<void> {
  const document = emptyDocument()
  document.meta.title = 'Catalog controls fixture'
  document.meta.slug = `catalog-controls-${crypto.randomUUID()}`
  await writeDocument(page, document)
}

async function chooseTags(page: Page): Promise<void> {
  const tags = page.getByRole('combobox', { name: 'Tags', exact: true })
  await tags.click()
  const search = page.getByRole('combobox', { name: 'Search tags', exact: true })
  await expect(search).toBeFocused()
  await search.fill('ALPHA')
  await expect(page.getByRole('option')).toHaveCount(1)
  await search.press('ArrowDown')
  await search.press('Enter')
  await expect(page.getByRole('option', { name: 'Alpha tag', exact: true })).toHaveAttribute('aria-selected', 'true')
  await search.fill('Beta')
  await page.getByRole('option', { name: 'Beta tag', exact: true }).click()
  await search.fill('Retired')
  await expect(page.getByRole('option', { name: 'Retired tag', exact: true })).toBeDisabled()
  await search.fill('missing-result')
  await expect(page.getByRole('status').filter({ hasText: 'No entries found' })).toBeVisible()
  await search.press('Escape')
  await expect(tags).toBeFocused()
  await expect(tags).toContainText('Alpha tag')
  await expect(tags).toContainText('Beta tag')
}

async function chooseSeries(page: Page): Promise<void> {
  const series = page.getByRole('combobox', { name: 'Series', exact: true })
  await series.click()
  await page.getByRole('combobox', { name: 'Search series', exact: true }).fill('Alpha')
  await page.getByRole('option', { name: 'Alpha series', exact: true }).click()
  await expect(series).toBeFocused()
  await page.getByLabel('Alpha series position', { exact: true }).fill('42')
  await saved(page)
  expect((await readMeta(page)).series[0]?.position).toBe(42)
  await series.click()
  await page.getByRole('combobox', { name: 'Search series', exact: true }).fill('Beta')
  await page.getByRole('option', { name: 'Beta series', exact: true }).click()
  await saved(page)
  const meta = await readMeta(page)
  expect(meta.series).toHaveLength(1)
  expect(meta.series[0]?.title).toBe('Beta series')
}

test('catalog Selects search, support multiple tags and replace series', async ({ page }, info) => {
  await fresh(page)
  await createEntry(page, 'tag', 'Alpha tag')
  await createEntry(page, 'tag', 'Beta tag')
  await createEntry(page, 'tag', 'Retired tag', true)
  await createEntry(page, 'series', 'Alpha series')
  await createEntry(page, 'series', 'Beta series')
  await page.getByText('Tags and series', { exact: true }).click()
  await expect(page.getByRole('button', { name: /Load (tag|series) catalog/ })).toHaveCount(0)
  await chooseTags(page)
  await saved(page)
  expect((await readMeta(page)).tags.map(tag => tag.label).sort()).toEqual(['Alpha tag', 'Beta tag'])
  await chooseSeries(page)
  const checkbox = page.getByRole('checkbox', { name: 'Exclude from search', exact: true })
  await expect(checkbox).toHaveClass(/ztd-checkbox/)
  await checkbox.check()
  await saved(page)
  expect((await readMeta(page)).seo.noindex).toBe(true)
  await page.reload()
  await expect(checkbox).toBeChecked()
  await page.getByText('Tags and series', { exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Tags', exact: true })).toContainText('Alpha tag')
  await expect(page.getByRole('combobox', { name: 'Series', exact: true })).toContainText('Beta series')
  await page.screenshot({ path: info.outputPath('catalog-selects-and-checkbox.png') })
})

test('catalog failures keep existing selections visible and retry within the searchable Select', async ({ page }) => {
  await fresh(page)
  await createEntry(page, 'tag', 'Retry tag')
  let failing = true
  await page.route('**/api/admin/catalog/tag', async (route) => {
    if (failing) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"CONNECTION_FAILED"}' })
    }
    else {
      await route.continue()
    }
  })
  await page.getByText('Tags and series', { exact: true }).click()
  await page.getByRole('combobox', { name: 'Tags', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Unable to load data. Please retry.')
  failing = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('option', { name: 'Retry tag', exact: true })).toBeVisible()
  await page.getByRole('option', { name: 'Retry tag', exact: true }).click()
  await page.keyboard.press('Escape')
  await saved(page)
  failing = true
  await page.getByRole('combobox', { name: 'Tags', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Unable to load data. Please retry.')
  await expect(page.getByRole('option', { name: 'Retry tag', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Escape')
  expect((await readMeta(page)).tags[0]?.label).toBe('Retry tag')
})

test('search composition commits text without selecting a catalog option or closing its Select', async ({ page }) => {
  await fresh(page)
  await createEntry(page, 'series', 'IME series')
  await page.getByText('Tags and series', { exact: true }).click()
  const series = page.getByRole('combobox', { name: 'Series', exact: true })
  await series.click()
  const search = page.getByRole('combobox', { name: 'Search series', exact: true })
  await search.fill('IME series')
  const option = page.getByRole('option', { name: 'IME series', exact: true })
  await expect(option).toBeVisible()
  await search.dispatchEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', isComposing: true })
  await expect(search).not.toHaveAttribute('aria-activedescendant')
  await search.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true })
  await search.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229 })
  await expect(search).toBeFocused()
  await expect(option).toHaveAttribute('aria-selected', 'false')
  await expect(series).toHaveAttribute('aria-expanded', 'true')
  expect((await readMeta(page)).series).toEqual([])
  await search.press('Enter')
  await expect(series).toHaveAttribute('aria-expanded', 'false')
  await expect(series).toContainText('IME series')
  await saved(page)
})

test('catalog Select fits the mobile settings drawer and uses Chinese labels', async ({ page }, info) => {
  await fresh(page)
  await createEntry(page, 'tag', '移动端标签')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('combobox', { name: 'Language', exact: true }).click()
  await page.getByRole('option', { name: '简体中文', exact: true }).click()
  await page.getByRole('button', { name: '文档设置', exact: true }).click()
  await page.getByText('标签与系列', { exact: true }).click()
  await page.getByRole('combobox', { name: '标签', exact: true }).click()
  await expect(page.getByRole('combobox', { name: '搜索标签', exact: true })).toBeFocused()
  await page.getByRole('option', { name: '移动端标签', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('catalog-select-mobile-chinese.png') })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('combobox', { name: '标签', exact: true })).toBeFocused()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
})

test.describe('catalog accessibility scanner', () => {
  // Axe clones styles without their CSP nonces; functional tests above retain the real policy.
  test.use({ bypassCSP: true })
  test('searchable catalog popups and checked shared Checkbox have no axe violations', async ({ page }, info) => {
    await fresh(page)
    await createEntry(page, 'tag', 'Accessible tag')
    await createEntry(page, 'series', 'Accessible series')
    await page.getByRole('checkbox', { name: 'Exclude from search', exact: true }).check()
    await saved(page)
    await page.getByText('Tags and series', { exact: true }).click()
    await assertAccessible(page, info, { label: 'catalog-checked-checkbox' })
    await page.getByRole('combobox', { name: 'Tags', exact: true }).click()
    await page.getByRole('option', { name: 'Accessible tag', exact: true }).click()
    await expect(page.getByRole('option', { name: 'Accessible tag', exact: true }))
      .toHaveAttribute('aria-selected', 'true')
    await saved(page)
    await assertAccessible(page, info, { label: 'catalog-searchable-tags-popup' })
    await page.keyboard.press('Escape')
    await page.getByRole('combobox', { name: 'Series', exact: true }).click()
    await page.getByRole('option', { name: 'Accessible series', exact: true }).click()
    await saved(page)
    await page.getByRole('combobox', { name: 'Series', exact: true }).click()
    await expect(page.getByRole('option', { name: 'Accessible series', exact: true }))
      .toHaveAttribute('aria-selected', 'true')
    await assertAccessible(page, info, { label: 'catalog-searchable-series-popup' })
  })
})
