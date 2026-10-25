import type { Page } from '@playwright/test'
import type { DocumentEntry } from '~/tests/components/support/domain-fixtures'
import {
  acknowledgementFor,
  documentEntry,
  documentFilters,
  documentsPage,
  publishedEntry,
  selectDocuments,
} from '~/tests/components/support/domain-fixtures'
import { documentsCopy } from '~/tests/components/support/expected-copy'
import { failure, serveApi } from '~/tests/components/support/http-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'

async function choose(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('a failed first load offers Try again and the retry renders the list', async ({ page }) => {
  const entry = documentEntry({ title: 'Recovered document' })
  let calls = 0
  const api = await serveApi(page, {
    'GET /api/admin/documents': (call) => {
      calls += 1
      if (calls === 1) {
        return failure(503, 'UNAVAILABLE')
      }
      return selectDocuments([entry], call)
    },
  })
  try {
    await mountSurface(page, { surface: 'documents' })
    const alert = page.getByRole('alert')
    await expect(alert).toContainText(documentsCopy.en.loadError)
    await alert.getByRole('button', { name: documentsCopy.en.retry, exact: true }).click()
    await expect(alert).toHaveCount(0)
    const rows = page.getByRole('list', { name: documentsCopy.en.title, exact: true })
    await expect(rows.getByRole('link', { name: entry.title, exact: true })).toBeVisible()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('filters narrow the list and their chips remove individually', async ({ page }, info) => {
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
    const documents = page.getByRole('list', { name: copy.title, exact: true })
    await expect(documents.getByRole('link')).toHaveCount(3)

    const search = page.getByRole('searchbox', { name: copy.search, exact: true })
    await search.fill(prefix)
    await page.getByRole('button', { name: copy.submit, exact: true }).click()
    await choose(page, copy.kind, 'Page')
    await choose(page, copy.state, copy.draft)
    await expect(documents.getByRole('link')).toHaveCount(1)
    await expect(documents).toContainText(pageTarget.title)

    const active = page.getByRole('list', { name: copy.activeFilters, exact: true })
    await expect(active.getByRole('button')).toHaveCount(3)
    await active.getByRole('button', { name: `${copy.removeFilter}: ${copy.kind}: Page`, exact: true }).click()
    await expect(page.getByRole('combobox', { name: copy.kind, exact: true })).toContainText(copy.allKinds)
    await expect(documents.getByRole('link')).toHaveCount(2)

    await choose(page, copy.kind, 'Page')
    await active.getByRole('button', { name: `${copy.removeFilter}: ${copy.search}: ${prefix}`, exact: true }).click()
    await expect(search).toHaveValue('')
    await expect(search).toBeFocused()
    await expect(active.getByRole('button')).toHaveCount(2)
    await page.screenshot({ path: info.outputPath('documents-filters-en-desktop.png') })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('clearing filters restores the unfiltered list', async ({ page }) => {
  const target = documentEntry({ kind: 'page', title: `Clear filters ${crypto.randomUUID()}` })
  const published = publishedEntry({ title: `Clear filters live ${crypto.randomUUID()}` })
  const api = await serveApi(page, {
    'GET /api/admin/documents': call => selectDocuments([target, published], call),
  })
  try {
    await mountSurface(page, { surface: 'documents' })
    const copy = documentsCopy.en
    const documents = page.getByRole('list', { name: copy.title, exact: true })
    await expect(documents.getByRole('link')).toHaveCount(2)

    const search = page.getByRole('searchbox', { name: copy.search, exact: true })
    await search.fill('No document will match this title')
    await page.getByRole('button', { name: copy.submit, exact: true }).click()
    await expect(page.getByText(copy.noMatches, { exact: true })).toBeVisible()
    await expect(documents.getByRole('link')).toHaveCount(0)

    await page.getByRole('button', { name: copy.clear, exact: true }).click()
    await expect(page.getByRole('combobox', { name: copy.kind, exact: true })).toContainText(copy.allKinds)
    await expect(search).toHaveValue('')
    await expect(documents.getByRole('link', { name: published.title, exact: true })).toBeVisible()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

// The row badge is the only place the three publication states are read: the
// mapping behind them is unit-proven, the rendered state is this case.
test('rows render the draft, published and changed badges', async ({ page }) => {
  const draft = documentEntry({ title: 'Badge draft' })
  const published = publishedEntry({ title: 'Badge published' })
  const changed = documentEntry({ title: 'Badge changed', liveRevisionId: crypto.randomUUID() })
  const api = await serveApi(page, {
    'GET /api/admin/documents': call => selectDocuments([
      draft,
      published,
      changed,
    ], call),
  })
  try {
    await mountSurface(page, { surface: 'documents' })
    const copy = documentsCopy.en
    const rows = page.getByRole('list', { name: copy.title, exact: true }).getByRole('listitem')
    await expect(rows).toHaveCount(3)
    const badges: (readonly [DocumentEntry, string, string])[] = [
      [
        draft,
        'draft',
        copy.draft,
      ],
      [
        published,
        'live',
        copy.published,
      ],
      [
        changed,
        'changed',
        copy.changed,
      ],
    ]
    for (const [entry, state, label] of badges) {
      const row = rows.filter({ hasText: entry.title })
      await expect(row.locator('.status-badge')).toHaveAttribute('data-state', state)
      await expect(row.locator('.status-badge')).toHaveText(label)
    }
    // A row also names its kind, so the badge is the publication state alone.
    await expect(rows.filter({ hasText: draft.title }).getByText('Post', { exact: true })).toBeVisible()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('trash rows restore to drafts and leave the trash list', async ({ page }) => {
  const prefix = `Trash boundary ${crypto.randomUUID()}`
  const target = documentEntry({ title: `${prefix} target`, version: 4 })
  const other = documentEntry({ title: `${prefix} other` })
  const restored = documentEntry({ title: `${prefix} target`, version: 5 })
  let restoreCommitted = false
  const api = await serveApi(page, {
    'GET /api/admin/documents': (call) => {
      const { state } = documentFilters(call.query)
      if (state === 'deleted') {
        return { body: documentsPage(restoreCommitted ? [other] : [target, other]) }
      }
      return selectDocuments([restored], call)
    },
    'POST /api/admin/documents/:id/restore-deleted': () => {
      restoreCommitted = true
      return { body: acknowledgementFor(target, { version: target.version + 1 }) }
    },
  })
  try {
    await mountSurface(page, { surface: 'documents' })
    const copy = documentsCopy.en
    await choose(page, copy.state, copy.trash)
    const documents = page.getByRole('list', { name: copy.title, exact: true })
    await expect(documents.getByRole('listitem')).toHaveCount(2)
    // Trash rows are not editable destinations, so they render as text.
    await expect(documents.getByRole('link')).toHaveCount(0)

    const row = documents.getByRole('listitem').filter({ hasText: target.title })
    const restore = row.getByRole('button', { name: copy.restore, exact: true })
    await expect(restore).toHaveAccessibleDescription(target.title)
    await restore.click()
    await expect(page.getByRole('status').filter({ hasText: copy.restored })).toBeVisible()
    await expect(row).toHaveCount(0)

    const restores = api.calls.filter(call => call.method === 'POST')
    expect(restores).toHaveLength(1)
    expect(restores[0]?.json).toEqual({ expectedVersion: target.version })

    await choose(page, copy.state, copy.draft)
    await expect(documents.getByRole('link', { name: restored.title, exact: true })).toBeVisible()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('Chinese labels and the filter bar reflow at 320px', async ({ page }, info) => {
  const draft = documentEntry({ kind: 'page', title: '页面草稿' })
  const api = await serveApi(page, {
    'GET /api/admin/documents': call => selectDocuments([draft], call),
  })
  try {
    await page.setViewportSize({ width: 320, height: 844 })
    await mountSurface(page, { surface: 'documents', locale: 'zh' })
    const copy = documentsCopy.zh
    await expect(page.getByRole('heading', { name: copy.title, exact: true })).toBeVisible()
    await expect(page.getByRole('searchbox', { name: copy.search, exact: true })).toBeVisible()
    await choose(page, copy.state, copy.draft)
    await expect(page.getByRole('combobox', { name: copy.state, exact: true })).toContainText(copy.draft)
    await expect(page.getByRole('button', { name: copy.newPost, exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: copy.kind, exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: copy.state, exact: true })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const width = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      viewport: window.innerWidth,
    }))
    expect(width.body).toBeLessThanOrEqual(width.viewport)
    await page.screenshot({ path: info.outputPath('documents-zh-mobile.png') })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
