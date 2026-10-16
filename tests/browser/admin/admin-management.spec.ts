import { captureState } from '@ztd-me/frontend-checks/playwright'
import { sessionSchema } from '@/content/contracts'
import { assetListSchema, catalogListSchema } from '@/content/service-contracts'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { expect, test } from '~/tests/support/browser/test'

test('catalog changes survive cancelled switches and require confirmation before clearing', async ({ page }) => {
  await page.goto('/__fixture/login')
  await page.getByRole('link', { name: 'Tags', exact: true }).click()
  const name = page.getByLabel('Name', { exact: true })
  const slug = page.getByLabel('Slug', { exact: true })
  const save = page.getByRole('button', { name: 'Save', exact: true })
  const create = page.getByRole('button', { name: 'New tag', exact: true })
  await expect(save).toBeDisabled()
  await name.fill('Protected catalog changes')
  await slug.fill('Invalid slug')
  expect(await slug.evaluate(element => element instanceof HTMLInputElement && element.validity.patternMismatch))
    .toBe(true)
  await slug.fill('protected-catalog-changes')
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible()
  await expect(slug).toHaveAccessibleDescription('Use lowercase letters, numbers and hyphens.')
  await create.click()
  const dialog = page.getByRole('dialog', { name: 'Discard unsaved catalog changes?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(create).toBeFocused()
  await expect(name).toHaveValue('Protected catalog changes')
  await expect(slug).toHaveValue('protected-catalog-changes')
  await save.click()
  const row = page.locator('.catalog-list li').filter({ hasText: 'Protected catalog changes' })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Edit Protected catalog changes' }).click()
  await expect(save).toBeDisabled()
  await name.fill('Keep this local name')
  await row.getByRole('button', { name: 'Edit Protected catalog changes' }).click()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(name).toHaveValue('Keep this local name')
  await page.locator('.admin-form').getByRole('button', { name: 'Cancel', exact: true }).click()
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(name).toHaveValue('')
  await expect(name).toBeFocused()
  await expect(save).toBeDisabled()
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0)
})

test('media upload failures stay in the queue after closing and retry the original file', async ({ page }) => {
  await page.goto('/__fixture/login')
  await page.getByRole('link', { name: 'Media library', exact: true }).click()
  await page.getByRole('button', { name: 'Upload media', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
  const picker = page.getByLabel('Media file')
  await expect(picker).toBeEnabled()
  await expect(picker).toHaveAccessibleDescription(/PNG \/ JPEG · 8 MiB/)
  const png = await page.screenshot({ type: 'png' })
  const file = { name: 'retry-global-media.png', mimeType: 'image/png', buffer: png }
  await page.route('**/api/admin/assets', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 503, json: { code: 'CONNECTION_FAILED' } })
    }
    else {
      await route.continue()
    }
  }, { times: 1 })
  await picker.setInputFiles(file)
  await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
  const upload = dialog.getByRole('listitem').filter({ hasText: file.name })
  await expect(upload.getByRole('alert')).toContainText('Connection failed')
  await expect(upload.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByRole('button', { name: 'Upload media', exact: true }).click()
  await expect(picker).toBeEnabled()
  await expect(upload.getByRole('alert')).toContainText('Connection failed')
  await upload.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(upload).toContainText('Upload complete.', { timeout: 15000 })
  await expect(upload.getByRole('alert')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  const card = page.locator('.media-card').filter({
    has: page.getByRole('heading', { name: file.name, exact: true }),
  })
  await expect(card).toBeVisible({ timeout: 15000 })
  await expect(card.getByRole('link', { name: 'Open media', exact: true }))
    .toHaveAccessibleDescription(file.name)
  await expect(card.getByRole('button', { name: 'Copy asset link', exact: true }))
    .toHaveAccessibleDescription(file.name)
})

test('global catalog managers create, rename, retire and recover from concurrent edits', async ({
  page,
}) => {
  await page.goto('/__fixture/login')
  await page.getByRole('link', { name: 'Tags', exact: true }).click()
  await page.getByLabel('Name', { exact: true }).fill('Admin fixture tag')
  await page.getByLabel('Slug', { exact: true }).fill('admin-fixture-tag')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const row = page.locator('.catalog-list li').filter({ hasText: 'Admin fixture tag' })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Edit Admin fixture tag' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Retired fixture tag')
  await page.getByLabel('Retired', { exact: true }).check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(row).toHaveCount(0)
  const retired = page.locator('.catalog-list li').filter({ hasText: 'Retired fixture tag' })
  await expect(retired.getByText('Retired', { exact: true })).toBeVisible()
  await retired.getByRole('button', { name: 'Edit Retired fixture tag' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Local retained change')
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  const entries = catalogListSchema.parse(
    await (await page.request.get('/api/admin/catalog/tag')).json(),
  )
  const entry = entries.items.find(item => item.slug === 'admin-fixture-tag')
  expect(entry).toBeDefined()
  const change = await page.request.put(`/api/admin/catalog/tag/${entry?.id ?? ''}`, {
    headers: {
      'origin': new URL(page.url()).origin,
      'x-csrf-token': session.csrfToken,
      'idempotency-key': crypto.randomUUID(),
    },
    data: {
      name: 'Changed elsewhere',
      slug: 'admin-fixture-tag',
      retired: true,
      expectedVersion: entry?.version,
    },
  })
  expect(change.ok()).toBe(true)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('changed elsewhere')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Local retained change')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(
    page.locator('.catalog-list li').filter({ hasText: 'Local retained change' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Series', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Series', exact: true })).toBeVisible()
})

test('global media uploads remain private and operations show real counters', async ({
  page,
  context,
}) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/__fixture/login')
  await page.getByRole('link', { name: 'Media library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible()
  const png = await page.screenshot({ type: 'png' })
  await page.getByRole('button', { name: 'Upload media', exact: true }).click()
  await expect(page.getByLabel('Media file')).toBeEnabled()
  await page
    .getByLabel('Media file')
    .setInputFiles({ name: 'global-media.png', mimeType: 'image/png', buffer: png })
  const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
  await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
  await expect(dialog).toContainText('Upload complete.', { timeout: 15000 })
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  const card = page.locator('.media-card').filter({
    has: page.getByRole('heading', { name: 'global-media.png', exact: true }),
  })
  await expect(card).toBeVisible({ timeout: 15000 })
  await expect(card.locator('img')).toBeVisible()
  const list = assetListSchema.parse(await (await page.request.get('/api/admin/assets')).json())
  const asset = list.items.find(item => item.filename === 'global-media.png')
  expect(asset).toBeDefined()
  expect((await page.request.get(asset?.url ?? '')).status()).toBe(404)
  const anonymous = await context.browser()?.newContext()
  expect(
    (
      await anonymous?.request.get(
        new URL(`/api/admin/assets/${asset?.assetId ?? ''}/content`, page.url()).href,
      )
    )?.status(),
  ).toBe(401)
  await anonymous?.close()
  await page.getByRole('link', { name: 'Operations', exact: true }).click()
  await expect(page.getByText('Ready media', { exact: true })).toBeVisible()
  await expect(page.getByText('Storage and content', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test.describe('accessibility scanner', () => {
  test.use({ bypassCSP: true })
  test('management pages are accessible in Chinese dark mode and narrow layouts', async ({
    page,
  }, info) => {
    await page.goto('/__fixture/login')
    await page.getByRole('combobox', { name: 'Language', exact: true }).click()
    await page.getByRole('option', { name: '简体中文', exact: true }).click()
    await page.getByRole('button', { name: '外观', exact: true }).click()
    await page.getByRole('menuitemradio', { name: '深色', exact: true }).click()
    for (const route of [
      'documents',
      'media',
      'tags',
      'series',
      'operations',
    ]) {
      await page.goto(`/admin/${route}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('status').filter({ hasText: '加载中…' })).toHaveCount(0)
      await assertAccessible(page, info, { label: `admin-${route}-zh-dark` })
      await page.screenshot({ path: info.outputPath(`admin-${route}-desktop.png`), fullPage: true })
      await page.setViewportSize({ width: 320, height: 740 })
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      await captureState(page, info, `admin-${route}-320`)
      await page.screenshot({ path: info.outputPath(`admin-${route}-320.png`), fullPage: true })
      await page.setViewportSize({ width: 1440, height: 1000 })
    }
  })
})
