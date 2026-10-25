import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { mutate } from '~/tests/support/browser/api'
import { seedDocument } from '~/tests/support/browser/document'

export const labels = {
  en: {
    heading: 'Documents',
    state: 'Publication state',
    trash: 'Trash',
    search: 'Search by title',
    submit: 'Search',
    restore: 'Restore draft',
    refresh: 'Refresh list',
  },
} as const

export async function deletedDocument(page: Page, title: string): Promise<Awaited<ReturnType<typeof mutate>>> {
  const document = emptyDocument()
  document.meta.title = title
  document.meta.slug = `trash-boundary-${crypto.randomUUID()}`
  // Trash rows are read from the list, so the fixture seeds the document through
  // the API and never opens the editor it is about to delete.
  const saved = await seedDocument(page, document)
  return await mutate(page, `/api/admin/documents/${saved.documentId}`, {
    expectedVersion: saved.version,
    expectedLiveGeneration: saved.liveGeneration,
  }, 'DELETE')
}

export async function trashFixture(page: Page): Promise<{
  target: Awaited<ReturnType<typeof mutate>>
  row: Locator
  other: Locator
  query: string
}> {
  const query = `Trash boundary ${crypto.randomUUID()}`
  const target = await deletedDocument(page, `${query} target`)
  await deletedDocument(page, `${query} other`)
  await page.goto('/admin/documents')
  const copy = labels.en
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
