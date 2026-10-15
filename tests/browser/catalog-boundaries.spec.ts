import { expect, test } from '@playwright/test'
import { catalogItemSchema } from '../../src/content/service-contracts'
import { fixture, writeCatalog } from './catalog-boundary-helpers'

for (const kind of ['tag', 'series'] as const) {
  test(`a slow ${kind} refresh cannot retarget a different entry's form`, async ({ page }) => {
    const { first, second, path } = await fixture(page, kind)
    await page.getByRole('button', { name: `Edit ${first.name}`, exact: true }).click()
    let release = (): void => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(`**${path}`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      const response = await route.fetch()
      await held
      await route.fulfill({ response })
    })
    const reading = page.waitForRequest(request => request.url().endsWith(path) && request.method() === 'GET')
    const refresh = page.getByRole('button', { name: 'Refresh', exact: true })
    await refresh.click()
    await reading
    await page.getByRole('button', { name: `Edit ${second.name}`, exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('Local change to B')
    await page.getByLabel('Slug', { exact: true }).fill(`local-b-${crypto.randomUUID()}`)
    release()
    await expect(refresh).toBeEnabled()
    const written = page.waitForResponse(response => response.url().includes(`${path}/`)
      && response.request().method() === 'PUT')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    const saved = catalogItemSchema.parse(await (await written).json())
    expect(saved.id).toBe(second.id)
    expect(saved.name).toBe('Local change to B')
  })

  test(`refreshing a clean ${kind} form adopts remote fields without marking it dirty`, async ({ page }) => {
    const { first } = await fixture(page, kind)
    await page.getByRole('button', { name: `Edit ${first.name}`, exact: true }).click()
    const remote = await writeCatalog(page, kind, {
      name: 'Remote catalog update',
      slug: `remote-${crypto.randomUUID()}`,
      retired: true,
      expectedVersion: first.version,
    }, first.id)
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(remote.name)
    await expect(page.getByLabel('Slug', { exact: true })).toHaveValue(remote.slug)
    await expect(page.getByLabel('Retired', { exact: true })).toBeChecked()
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0)
  })

  test(`refreshing a dirty ${kind} form preserves local edits and adopts untouched remote fields`, async ({ page }) => {
    const { first } = await fixture(page, kind)
    await page.getByRole('button', { name: `Edit ${first.name}`, exact: true }).click()
    await page.getByLabel('Name', { exact: true }).fill('Local name survives refresh')
    const remote = await writeCatalog(page, kind, {
      name: 'Remote changed name',
      slug: `remote-${crypto.randomUUID()}`,
      retired: true,
      expectedVersion: first.version,
    }, first.id)
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Local name survives refresh')
    await expect(page.getByLabel('Slug', { exact: true })).toHaveValue(remote.slug)
    await expect(page.getByLabel('Retired', { exact: true })).toBeChecked()
    const response = page.waitForResponse(result => result.request().method() === 'PUT'
      && result.url().endsWith(first.id))
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    expect(catalogItemSchema.parse(await (await response).json())).toMatchObject({
      name: 'Local name survives refresh',
      slug: remote.slug,
      retired: true,
      version: remote.version + 1,
    })
  })
}

test('a confirmed catalog creation stays visible when the list refresh fails', async ({ page }, info) => {
  const { path } = await fixture(page, 'tag')
  const name = `Acknowledged ${crypto.randomUUID()}`
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Slug', { exact: true }).fill(`acknowledged-${crypto.randomUUID()}`)
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } })
    }
    else {
      await route.continue()
    }
  })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Catalog entry created.' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Unable to load data.')
  await expect(page.getByRole('button', { name: `Edit ${name}`, exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('catalog-save-refresh-failed.png') })
  await page.getByLabel('Name', { exact: true }).fill('Another unsaved entry')
  await expect(page.getByRole('status').filter({ hasText: 'Catalog entry created.' })).toHaveCount(0)
})

test('a slow refresh cannot turn a new catalog entry into an update of the old entry', async ({ page }) => {
  const { first, path } = await fixture(page, 'tag')
  await page.getByRole('button', { name: `Edit ${first.name}`, exact: true }).click()
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    const response = await route.fetch()
    await held
    await route.fulfill({ response })
  })
  const reading = page.waitForRequest(request => request.url().endsWith(path) && request.method() === 'GET')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await reading
  await page.getByRole('button', { name: 'New tag', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('A new catalog entry')
  await page.getByLabel('Slug', { exact: true }).fill(`new-after-refresh-${crypto.randomUUID()}`)
  release()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
  const response = page.waitForResponse(result => result.request().method() === 'POST' && result.url().endsWith(path))
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect(catalogItemSchema.parse(await (await response).json()).id).not.toBe(first.id)
  await expect(page.getByRole('button', { name: `Edit ${first.name}`, exact: true })).toBeVisible()
})

test('catalog retries an unknown creation after refreshing with the original idempotency key', async ({ page }) => {
  const { path } = await fixture(page, 'tag')
  const name = `Unknown creation ${crypto.randomUUID()}`
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Slug', { exact: true }).fill(`unknown-${crypto.randomUUID()}`)
  const keys: string[] = []
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    keys.push(route.request().headers()['idempotency-key'] ?? '')
    if (keys.length === 1) {
      await route.fetch()
      await route.abort('failed')
    }
    else {
      await route.continue()
    }
  })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Connection failed')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('button', { name: `Edit ${name}`, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Catalog entry created.' })).toBeVisible()
  expect(keys).toHaveLength(2)
  expect(keys[0]).not.toBe('')
  expect(keys[1]).toBe(keys[0])
  await expect(page.getByRole('button', { name: `Edit ${name}`, exact: true })).toHaveCount(1)
})
