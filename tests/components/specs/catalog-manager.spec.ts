import type { CatalogEntry } from '~/tests/components/support/domain-fixtures'
import type { ApiCall } from '~/tests/components/support/http-fixtures'
import { catalogUpdateSchema } from '@/contracts/catalog'
import { catalogEntry, catalogPage } from '~/tests/components/support/domain-fixtures'
import { catalogCopy } from '~/tests/components/support/expected-copy'
import { defer, failure, lostResponse, serveApi } from '~/tests/components/support/http-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'

type Kind = 'tag' | 'series'
const surface = (kind: Kind): 'catalog-tag' | 'catalog-series' => (kind === 'tag' ? 'catalog-tag' : 'catalog-series')
const path = (kind: Kind): string => `/api/admin/catalog/${kind}`

/** The entry the fixture's server would return for an accepted update. */
function written(call: ApiCall, kind: Kind): CatalogEntry {
  // The fixture only answers bodies the product's own update contract accepts.
  const body = catalogUpdateSchema.parse(call.json)
  return catalogEntry({
    kind,
    id: call.path.split('/').at(-1) ?? '',
    name: body.name,
    slug: body.slug,
    retired: body.retired,
    version: body.expectedVersion + 1,
  })
}

for (const kind of ['tag', 'series'] as const) {
  // A refresh started while entry A was being edited must not move B's saved
  // values. The identity of the written entry is the assertion.
  test(`a slow ${kind} refresh cannot retarget a different entry's form`, async ({ page }) => {
    const unique = crypto.randomUUID()
    const first = catalogEntry({ kind, name: `Boundary A ${unique}`, slug: `boundary-a-${unique}` })
    const second = catalogEntry({ kind, name: `Boundary B ${unique}`, slug: `boundary-b-${unique}` })
    const held = defer()
    const captured = defer()
    let listCalls = 0
    const api = await serveApi(page, {
      [`GET ${path(kind)}`]: async () => {
        listCalls += 1
        if (listCalls === 1) {
          return { body: catalogPage([first, second]) }
        }
        captured.open()
        await held.promise
        return { body: catalogPage([first, second]) }
      },
      [`PUT ${path(kind)}/:id`]: call => ({ body: written(call, kind) }),
    })
    try {
      await mountSurface(page, { surface: surface(kind) })
      const copy = catalogCopy.en
      await page.getByRole('button', { name: `${copy.edit} ${first.name}`, exact: true }).click()
      await expect(page.getByLabel(copy.name, { exact: true })).toHaveValue(first.name)
      await expect(page.getByLabel(copy.slug, { exact: true })).toHaveValue(first.slug)
      const refresh = page.getByRole('button', { name: copy.refresh, exact: true })
      await refresh.click()
      await captured.promise
      await page.getByRole('button', { name: `${copy.edit} ${second.name}`, exact: true }).click()
      await page.getByLabel(copy.name, { exact: true }).fill('Local change to B')
      await page.getByLabel(copy.slug, { exact: true }).fill(`local-b-${unique}`)
      held.open()
      await expect(refresh).toBeEnabled()

      await page.getByRole('button', { name: copy.save, exact: true }).click()
      const writes = api.calls.filter(call => call.method === 'PUT')
      expect(writes).toHaveLength(1)
      expect(writes[0]?.path.endsWith(second.id)).toBe(true)
      expect(writes[0]?.json).toMatchObject({
        name: 'Local change to B',
        slug: `local-b-${unique}`,
        expectedVersion: second.version,
      })
      await expect(page.getByRole('status').filter({ hasText: copy.saved })).toBeVisible()
      await api.expectServed()
    }
    finally {
      held.open()
      await api.dispose()
    }
  })
}

test('refreshing a clean tag form adopts remote fields without marking it dirty', async ({ page }) => {
  const unique = crypto.randomUUID()
  const first = catalogEntry({ kind: 'tag', name: `Clean A ${unique}`, slug: `clean-a-${unique}` })
  const remote = catalogEntry({
    kind: 'tag',
    id: first.id,
    name: 'Remote catalog update',
    slug: `remote-${unique}`,
    retired: true,
    version: first.version + 1,
  })
  let listCalls = 0
  const api = await serveApi(page, {
    'GET /api/admin/catalog/tag': () => {
      listCalls += 1
      return { body: catalogPage(listCalls === 1 ? [first] : [remote]) }
    },
  })
  try {
    await mountSurface(page, { surface: 'catalog-tag' })
    const copy = catalogCopy.en
    await page.getByRole('button', { name: `${copy.edit} ${first.name}`, exact: true }).click()
    await page.getByRole('button', { name: copy.refresh, exact: true }).click()
    await expect(page.getByLabel(copy.name, { exact: true })).toHaveValue(remote.name)
    await expect(page.getByLabel(copy.slug, { exact: true })).toHaveValue(remote.slug)
    await expect(page.getByLabel(copy.retired, { exact: true })).toBeChecked()
    await expect(page.getByRole('button', { name: copy.save, exact: true })).toBeDisabled()
    await expect(page.getByText(copy.unsaved, { exact: true })).toHaveCount(0)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('refreshing a dirty tag form preserves local edits and adopts untouched remote fields', async ({ page }) => {
  const unique = crypto.randomUUID()
  const first = catalogEntry({ kind: 'tag', name: `Dirty A ${unique}`, slug: `dirty-a-${unique}` })
  const remote = catalogEntry({
    kind: 'tag',
    id: first.id,
    name: 'Remote changed name',
    slug: `remote-${unique}`,
    retired: true,
    version: first.version + 1,
  })
  let listCalls = 0
  const api = await serveApi(page, {
    'GET /api/admin/catalog/tag': () => {
      listCalls += 1
      return { body: catalogPage(listCalls === 1 ? [first] : [remote]) }
    },
    'PUT /api/admin/catalog/tag/:id': call => ({ body: written(call, 'tag') }),
  })
  try {
    await mountSurface(page, { surface: 'catalog-tag' })
    const copy = catalogCopy.en
    await page.getByRole('button', { name: `${copy.edit} ${first.name}`, exact: true }).click()
    await page.getByLabel(copy.name, { exact: true }).fill('Local name survives refresh')
    await page.getByRole('button', { name: copy.refresh, exact: true }).click()
    await expect(page.getByLabel(copy.name, { exact: true })).toHaveValue('Local name survives refresh')
    await expect(page.getByLabel(copy.slug, { exact: true })).toHaveValue(remote.slug)
    await expect(page.getByLabel(copy.retired, { exact: true })).toBeChecked()

    await page.getByRole('button', { name: copy.save, exact: true }).click()
    const writes = api.calls.filter(call => call.method === 'PUT')
    expect(writes).toHaveLength(1)
    expect(writes[0]?.json).toMatchObject({
      name: 'Local name survives refresh',
      slug: remote.slug,
      retired: true,
      expectedVersion: remote.version,
    })
    await expect(page.getByRole('status').filter({ hasText: copy.saved })).toBeVisible()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('a series form creates through the series endpoint', async ({ page }) => {
  const created = catalogEntry({ kind: 'series', name: 'Series entry', slug: 'series-entry' })
  let listCalls = 0
  const api = await serveApi(page, {
    'GET /api/admin/catalog/series': () => {
      listCalls += 1
      return { body: catalogPage(listCalls === 1 ? [] : [created]) }
    },
    'POST /api/admin/catalog/series': () => ({ body: created }),
  })
  try {
    await mountSurface(page, { surface: 'catalog-series' })
    const copy = catalogCopy.en
    await expect(page.getByRole('heading', { name: copy.series, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: copy.newSeries, exact: true })).toBeVisible()
    await page.getByLabel(copy.name, { exact: true }).fill(created.name)
    await page.getByLabel(copy.slug, { exact: true }).fill(created.slug)
    await page.getByRole('button', { name: copy.save, exact: true }).click()
    const writes = api.calls.filter(call => call.method === 'POST')
    expect(writes).toHaveLength(1)
    // A creation posts to the collection, never as an update of another entry.
    expect(writes[0]?.path).toBe('/api/admin/catalog/series')
    expect(writes[0]?.json).toEqual({ name: created.name, slug: created.slug })
    await expect(page.getByRole('status').filter({ hasText: copy.created })).toBeVisible()
    await expect(page.getByRole('button', { name: `${copy.edit} ${created.name}`, exact: true })).toBeVisible()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('a confirmed catalog creation stays visible when the list refresh fails', async ({ page }, info) => {
  const unique = crypto.randomUUID()
  const name = `Acknowledged ${unique}`
  const created = catalogEntry({ kind: 'tag', name, slug: `acknowledged-${unique}` })
  let listCalls = 0
  const api = await serveApi(page, {
    'GET /api/admin/catalog/tag': () => {
      listCalls += 1
      return listCalls === 1 ? { body: catalogPage([]) } : failure(503, 'UNAVAILABLE')
    },
    'POST /api/admin/catalog/tag': () => ({ body: created }),
  })
  try {
    await mountSurface(page, { surface: 'catalog-tag' })
    const copy = catalogCopy.en
    await page.getByLabel(copy.name, { exact: true }).fill(created.name)
    await page.getByLabel(copy.slug, { exact: true }).fill(created.slug)
    await page.getByRole('button', { name: copy.save, exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: copy.created })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(copy.loadError)
    // The acknowledged entry is already committed, so it stays listed.
    await expect(page.getByRole('button', { name: `${copy.edit} ${name}`, exact: true })).toBeVisible()
    await page.screenshot({ path: info.outputPath('catalog-save-refresh-failed.png') })
    await page.getByLabel(copy.name, { exact: true }).fill('Another unsaved entry')
    await expect(page.getByRole('status').filter({ hasText: copy.created })).toHaveCount(0)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('a slow refresh cannot turn a new catalog entry into an update of the old entry', async ({ page }) => {
  const unique = crypto.randomUUID()
  const first = catalogEntry({ kind: 'tag', name: `Original ${unique}`, slug: `original-${unique}` })
  const created = catalogEntry({ kind: 'tag', name: 'A new catalog entry', slug: `new-after-refresh-${unique}` })
  const held = defer()
  const captured = defer()
  let listCalls = 0
  const api = await serveApi(page, {
    'GET /api/admin/catalog/tag': async () => {
      listCalls += 1
      if (listCalls === 1) {
        return { body: catalogPage([first]) }
      }
      captured.open()
      await held.promise
      return { body: catalogPage([first, created]) }
    },
    'POST /api/admin/catalog/tag': () => ({ body: created }),
  })
  try {
    await mountSurface(page, { surface: 'catalog-tag' })
    const copy = catalogCopy.en
    await page.getByRole('button', { name: `${copy.edit} ${first.name}`, exact: true }).click()
    const refresh = page.getByRole('button', { name: copy.refresh, exact: true })
    await refresh.click()
    await captured.promise
    await page.getByRole('button', { name: copy.newTag, exact: true }).click()
    await page.getByLabel(copy.name, { exact: true }).fill(created.name)
    await page.getByLabel(copy.slug, { exact: true }).fill(created.slug)
    held.open()
    await expect(refresh).toBeEnabled()

    await page.getByRole('button', { name: copy.save, exact: true }).click()
    const writes = api.calls.filter(call => call.method === 'POST')
    expect(writes).toHaveLength(1)
    expect(writes[0]?.path).toBe('/api/admin/catalog/tag')
    expect(writes[0]?.json).toEqual({ name: created.name, slug: created.slug })
    await expect(page.getByRole('button', { name: `${copy.edit} ${first.name}`, exact: true })).toBeVisible()
    await api.expectServed()
  }
  finally {
    held.open()
    await api.dispose()
  }
})

test('catalog retries an unknown creation with the original idempotency key', async ({ page }) => {
  const unique = crypto.randomUUID()
  const created = catalogEntry({ kind: 'tag', name: `Unknown creation ${unique}`, slug: `unknown-${unique}` })
  const keys: (string | undefined)[] = []
  let committed = false
  const api = await serveApi(page, {
    'GET /api/admin/catalog/tag': () => ({ body: catalogPage(committed ? [created] : []) }),
    'POST /api/admin/catalog/tag': (call) => {
      keys.push(call.headers['idempotency-key'])
      // The fixture's server stored the entry; only the answer was lost.
      committed = true
      if (keys.length === 1) {
        return lostResponse()
      }
      return { body: created }
    },
  })
  try {
    await mountSurface(page, { surface: 'catalog-tag' })
    const copy = catalogCopy.en
    await page.getByLabel(copy.name, { exact: true }).fill(created.name)
    await page.getByLabel(copy.slug, { exact: true }).fill(created.slug)
    await page.getByRole('button', { name: copy.save, exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(copy.connectionFailed)
    // A committed creation shows up on refresh, and the retry reuses its key.
    await page.getByRole('button', { name: copy.refresh, exact: true }).click()
    await expect(page.getByRole('button', { name: `${copy.edit} ${created.name}`, exact: true })).toBeVisible()
    await page.getByRole('button', { name: copy.save, exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: copy.created })).toBeVisible()
    expect(keys).toHaveLength(2)
    expect(keys[0]).not.toBe('')
    expect(keys[1]).toBe(keys[0])
    await expect(page.getByRole('button', { name: `${copy.edit} ${created.name}`, exact: true })).toHaveCount(1)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
