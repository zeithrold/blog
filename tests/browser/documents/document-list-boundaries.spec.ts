import { acknowledgementSchema, openDocumentSchema } from '@/content/contracts'
import { mutate } from '~/tests/support/browser/api'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'
import { labels, trashFixture } from './document-list-boundary-helpers'

test('pagination reveals its failure and retries the same page without duplicating loaded rows', async ({ page }) => {
  const entries = Array.from({ length: 50 }, (_, index) => ({
    documentId: crypto.randomUUID(),
    kind: 'article',
    title: `Boundary document ${index}`,
    version: 1,
    headRevisionId: crypto.randomUUID(),
    liveRevisionId: null,
    updatedAt: Date.now() - index,
  }))
  const next = { ...entries[0], documentId: crypto.randomUUID(), title: 'Boundary next page document' }
  const cursors: (string | null)[] = []
  await page.route('**/api/admin/documents**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname !== '/api/admin/documents' || route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    const cursor = url.searchParams.get('cursor')
    cursors.push(cursor)
    if (cursors.length === 2) {
      await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } })
    }
    else {
      await route.fulfill({ json: {
        items: cursor === null
          ? entries
          : [
              entries[0],
              next,
            ],
        nextCursor: cursor === null ? 'boundary-next' : null,
      } })
    }
  })
  await page.goto('/__fixture/login')
  const list = page.getByRole('list', { name: 'Documents', exact: true })
  await expect(list.getByRole('listitem')).toHaveCount(50)
  await page.getByRole('button', { name: 'Load more', exact: true }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Unable to load the next page.')
  await expect(alert).toBeInViewport()
  await expect(alert).toBeFocused()
  await expect(list.getByRole('listitem')).toHaveCount(50)
  await alert.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(alert).toHaveCount(0)
  await expect(list.getByRole('listitem')).toHaveCount(51)
  await expect(list.getByRole('link', { name: 'Boundary next page document', exact: true })).toBeVisible()
  expect(cursors).toEqual([
    null,
    'boundary-next',
    'boundary-next',
  ])
  await expect(page.getByRole('button', { name: 'Load more', exact: true })).toHaveCount(0)
})

for (const [locale, width] of [
  ['en', 1440],
  ['en', 800],
  ['zh', 1440],
  ['zh', 390],
  ['zh', 320],
] as const) {
  test(`confirmed restore survives refresh failure in ${locale} at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    const { target, row, other } = await trashFixture(page, locale)
    const copy = labels[locale]
    const restore = row.getByRole('button', { name: copy.restore, exact: true })
    await page.screenshot({ path: info.outputPath(`trash-before-restore-${locale}.png`) })
    await horizontalBounds(page, restore)
    const edges = await restore.evaluate(element => ({
      button: element.getBoundingClientRect().right,
      panel: element.closest('.document-list-panel')?.getBoundingClientRect().right ?? 0,
    }))
    expect(edges.button).toBeLessThanOrEqual(edges.panel)
    expect(await restore.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    const search = page.getByRole('searchbox', { name: copy.search, exact: true })
    await search.fill('Unsubmitted search text')
    let release = (): void => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/api/admin/documents?*', async (route) => {
      await held
      await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } })
    })
    const refreshing = page.waitForRequest(request => request.url().includes('/api/admin/documents?'))
    await restore.click()
    await refreshing
    await expect(row).toHaveCount(0)
    await expect(other.getByRole('button', { name: copy.restore, exact: true })).toBeDisabled()
    await expect(search).toHaveValue('Unsubmitted search text')
    release()
    await expect(page.getByRole('alert')).toContainText(copy.error)
    await expect(page.getByRole('alert')).toBeInViewport()
    await expect(page.getByRole('alert')).toBeFocused()
    await expect(page.getByRole('status').filter({ hasText: copy.restored })).toBeVisible()
    await expect(other.getByRole('button', { name: copy.restore, exact: true })).toBeEnabled()
    await expect(row).toHaveCount(0)
    const response = await page.request.get(`/api/admin/documents/${target.documentId}`)
    const current = openDocumentSchema.parse(await response.json())
    expect(current.version).toBe(target.version + 1)
    await horizontalBounds(page, page.getByRole('alert'))
    await page.screenshot({ path: info.outputPath(`trash-refresh-failed-${locale}.png`) })
    await page.unroute('**/api/admin/documents?*')
    await page.getByRole('button', { name: copy.retry, exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(search).toHaveValue('Unsubmitted search text')
    await expect(page.getByRole('combobox', { name: copy.state, exact: true })).toContainText(copy.trash)
    await expect(other).toBeVisible()
    await expect(row).toHaveCount(0)
    expect(page.url()).toContain('/admin/documents')
  })
}

test('trash retries a lost restoration response without restoring twice', async ({ page }) => {
  const { target, row } = await trashFixture(page)
  const keys: string[] = []
  await page.route(`**/api/admin/documents/${target.documentId}/restore-deleted`, async (route) => {
    keys.push(route.request().headers()['idempotency-key'] ?? '')
    if (keys.length === 1) {
      expect((await route.fetch()).ok()).toBe(true)
      await route.abort('failed')
    }
    else {
      await route.continue()
    }
  })
  await row.getByRole('button', { name: 'Restore draft', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The restoration result could not be confirmed.')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(row).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Document restored as a draft' })).toBeFocused()
  expect(keys).toHaveLength(2)
  expect(keys[0]).not.toBe('')
  expect(keys[1]).toBe(keys[0])
  const response = await page.request.get(`/api/admin/documents/${target.documentId}`)
  const current = openDocumentSchema.parse(await response.json())
  expect(current.version).toBe(target.version + 1)
})

test('trash conflict refreshes the list before another restore', async ({ page }) => {
  const { target, row } = await trashFixture(page)
  const path = `/api/admin/documents/${target.documentId}`
  const external = await mutate(page, `${path}/restore-deleted`, { expectedVersion: target.version })
  await mutate(page, path, {
    expectedVersion: external.version,
    expectedLiveGeneration: external.liveGeneration,
  }, 'DELETE')
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/restore-deleted')) {
      writes.push(request.method())
    }
  })
  await row.getByRole('button', { name: 'Restore draft', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('This document has changed.')
  await page.getByRole('alert').getByRole('button', { name: 'Refresh list', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(writes).toHaveLength(1)
  await row.getByRole('button', { name: 'Restore draft', exact: true }).click()
  await expect(row).toHaveCount(0)
  expect(writes).toHaveLength(2)
})

test('creating after a lost response opens the single confirmed document on retry', async ({ page }) => {
  await page.goto('/__fixture/login')
  let documentId = ''
  const keys: string[] = []
  await page.route('**/api/admin/documents', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    keys.push(route.request().headers()['idempotency-key'] ?? '')
    if (keys.length === 1) {
      const response = await route.fetch()
      documentId = acknowledgementSchema.parse(await response.json()).documentId
      await route.abort('failed')
    }
    else {
      await route.continue()
    }
  })
  await page.getByRole('button', { name: 'New post', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The creation result could not be confirmed.')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${documentId}$`))
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
  expect(keys).toHaveLength(2)
  expect(keys[1]).toBe(keys[0])
})
