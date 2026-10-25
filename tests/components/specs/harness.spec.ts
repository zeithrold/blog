import { mountSurface } from '../support/mount'
import { expect, test } from '../support/test'

const documentEntry = {
  documentId: '11111111-1111-4111-8111-111111111111',
  kind: 'article',
  title: 'Component harness document',
  version: 3,
  headRevisionId: '22222222-2222-4222-8222-222222222222',
  liveRevisionId: null,
  updatedAt: Date.UTC(2026, 0, 2),
}

const tagEntry = {
  id: '33333333-3333-4333-8333-333333333333',
  kind: 'tag',
  slug: 'craft',
  name: 'Craft',
  version: 1,
  retired: false,
}

const seriesEntry = {
  id: '44444444-4444-4444-8444-444444444444',
  kind: 'series',
  slug: 'building',
  name: 'Building',
  version: 2,
  retired: false,
}

test('documents keeps its real loading state until the spec answers the held list request', async ({ page }) => {
  let release = (): void => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let requests = 0
  await page.route(/\/api\/admin\/documents(?:\?|$)/, async (route) => {
    requests++
    expect(route.request().method()).toBe('GET')
    await released
    await route.fulfill({ status: 200, json: { items: [documentEntry], nextCursor: null } })
  })

  await mountSurface(page, { surface: 'documents' })
  await expect(page.getByRole('heading', { name: 'Documents', level: 1 })).toBeVisible()
  await expect(page.locator('.document-list-panel')).toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('.document-loading')).toContainText('Loading documents…')

  release()
  await expect(page.getByRole('link', { name: documentEntry.title, exact: true })).toBeVisible()
  await expect(page.locator('.document-list-panel')).toHaveAttribute('aria-busy', 'false')
  expect(requests).toBe(1)
  // The production stylesheet is present, not a harness-only approximation.
  await expect(page.locator('.document-list-panel')).toHaveCSS('border-radius', '12px')
})

test('documents surfaces a schema-invalid HTTP response as an error instead of an empty success', async ({ page }) => {
  await page.route(/\/api\/admin\/documents(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        items: [
          { documentId: 'not-a-uuid' },
        ],
        nextCursor: null,
      },
    })
  })

  await mountSurface(page, { surface: 'documents' })
  await expect(page.getByRole('alert')).toContainText('Unable to load documents. Check your connection and try again.')
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Documents', exact: true })).toHaveCount(0)
  await expect(page.locator('.document-row')).toHaveCount(0)
})

test('catalog tags renders the real manager from the spec-owned HTTP response', async ({ page }) => {
  await page.route(/\/api\/admin\/catalog\/tag$/, async (route) => {
    expect(route.request().method()).toBe('GET')
    await route.fulfill({ status: 200, json: { items: [tagEntry] } })
  })

  await mountSurface(page, { surface: 'catalog-tag' })
  await expect(page.getByRole('heading', { name: 'Tags', level: 1 })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Search catalog' })).toBeVisible()
  await expect(page.getByText('Craft', { exact: true })).toBeVisible()
  await expect(page.getByText('/tags/craft', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Craft', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('catalog series mounts the real Chinese dark surface from its own HTTP response', async ({ page }) => {
  await page.route(/\/api\/admin\/catalog\/series$/, async (route) => {
    expect(route.request().method()).toBe('GET')
    await route.fulfill({ status: 200, json: { items: [seriesEntry] } })
  })

  await mountSurface(page, { surface: 'catalog-series', locale: 'zh', mode: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.locator('html')).toHaveAttribute('data-frontend-mode', 'dark')
  await expect(page.getByRole('heading', { name: '系列', level: 1 })).toBeVisible()
  await expect(page.getByText('Building', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '编辑 Building', exact: true })).toBeVisible()
  // A real theme token, resolved by the production stylesheet for dark mode.
  expect(await page.locator('html').evaluate(element =>
    getComputedStyle(element).getPropertyValue('--ztd-background').trim(),
  )).not.toBe('')
})
