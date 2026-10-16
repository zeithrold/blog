import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { mutate } from '~/tests/support/browser/api'
import { writeDocument } from '~/tests/support/browser/document'

export const labels = {
  en: {
    heading: 'Documents',
    state: 'Publication state',
    trash: 'Trash',
    search: 'Search by title',
    submit: 'Search',
    restore: 'Restore draft',
    restored: 'Document restored as a draft',
    refresh: 'Refresh list',
    retry: 'Try again',
    error: 'Unable to load documents',
  },
  zh: {
    heading: '文档',
    state: '发布状态',
    trash: '回收站',
    search: '按标题搜索',
    submit: '搜索',
    restore: '恢复为草稿',
    restored: '文档已恢复为草稿',
    refresh: '刷新列表',
    retry: '重试',
    error: '文档加载失败',
  },
} as const

export async function deletedDocument(page: Page, title: string): Promise<Awaited<ReturnType<typeof mutate>>> {
  const document = emptyDocument()
  document.meta.title = title
  document.meta.slug = `trash-boundary-${crypto.randomUUID()}`
  const saved = await writeDocument(page, document)
  return await mutate(page, `/api/admin/documents/${saved.documentId}`, {
    expectedVersion: saved.version,
    expectedLiveGeneration: saved.liveGeneration,
  }, 'DELETE')
}

export async function trashFixture(page: Page, locale: 'en' | 'zh' = 'en'): Promise<{
  target: Awaited<ReturnType<typeof mutate>>
  row: Locator
  other: Locator
  query: string
}> {
  const query = `Trash boundary ${crypto.randomUUID()}`
  const target = await deletedDocument(page, `${query} target`)
  await deletedDocument(page, `${query} other`)
  await page.goto('/admin/documents')
  if (locale === 'zh') {
    await page.getByRole('combobox', { name: 'Language', exact: true }).click()
    await page.getByRole('option', { name: '简体中文', exact: true }).click()
  }
  const copy = labels[locale]
  await expect(page.getByRole('heading', { name: copy.heading, exact: true })).toBeVisible()
  await page.getByRole('searchbox', { name: copy.search, exact: true }).fill(query)
  await page.getByRole('button', { name: copy.submit, exact: true }).click()
  await page.getByRole('combobox', { name: copy.state, exact: true }).click()
  await page.getByRole('option', { name: copy.trash, exact: true }).click()
  const list = page.getByRole('list', { name: copy.heading, exact: true })
  const row = list.getByRole('listitem').filter({ hasText: `${query} target` })
  const other = list.getByRole('listitem').filter({ hasText: `${query} other` })
  await expect(row).toBeVisible()
  await expect(other).toBeVisible()
  return { target, row, other, query }
}
