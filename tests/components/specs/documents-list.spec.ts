import type { Page } from '@playwright/test'
import {
  documentEntry,
  publishedEntry,
  selectDocuments,
} from '~/tests/components/support/domain-fixtures'
import { documentsCopy } from '~/tests/components/support/expected-copy'
import { serveApi } from '~/tests/components/support/http-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'

async function choose(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('removing the search chip returns native focus to the search field', async ({ page }) => {
  const prefix = `Admin browser ${crypto.randomUUID()}`
  const pageTarget = documentEntry({ kind: 'page', title: `${prefix} page target` })
  const postTarget = documentEntry({ title: `${prefix} post target` })
  const published = publishedEntry({ title: `${prefix} published target` })
  const api = await serveApi(page, {
    'GET /api/admin/documents': call => selectDocuments([
      pageTarget,
      postTarget,
      published,
    ], call),
  })
  try {
    await mountSurface(page, { surface: 'documents' })
    const copy = documentsCopy.en
    const search = page.getByRole('searchbox', { name: copy.search, exact: true })
    await search.fill(prefix)
    await page.getByRole('button', { name: copy.submit, exact: true }).click()
    await choose(page, copy.kind, 'Page')
    await choose(page, copy.state, copy.draft)
    const active = page.getByRole('list', { name: copy.activeFilters, exact: true })
    await active.getByRole('button', { name: `${copy.removeFilter}: ${copy.kind}: Page`, exact: true }).click()

    await choose(page, copy.kind, 'Page')
    await active.getByRole('button', { name: `${copy.removeFilter}: ${copy.search}: ${prefix}`, exact: true }).click()
    await expect(search).toBeFocused()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('Chinese filter bar stays inside the 320px viewport', async ({ page }) => {
  const draft = documentEntry({ kind: 'page', title: '页面草稿' })
  const api = await serveApi(page, {
    'GET /api/admin/documents': call => selectDocuments([draft], call),
  })
  try {
    await page.setViewportSize({ width: 320, height: 844 })
    await mountSurface(page, { surface: 'documents', locale: 'zh' })
    const width = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      viewport: window.innerWidth,
    }))
    expect(width.body).toBeLessThanOrEqual(width.viewport)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
