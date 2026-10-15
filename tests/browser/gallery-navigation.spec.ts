import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { assertAccessible } from './accessibility'
import { interruptTransfer } from './media-transfer-helpers'

async function enterGallery(page: Page): Promise<void> {
  await page.goto('/__fixture/login')
  await page.goto('/admin/tags')
  await page.getByRole('link', { name: 'Media library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Upload media', exact: true }).click()
}

for (const width of [1440, 320]) {
  test(`gallery retains queued files after navigating away and back at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 740 })
    if (width === 320) {
      await page.goto('/__fixture/login')
      await page.goto('/admin/media')
      await page.getByRole('button', { name: 'Upload media', exact: true }).click()
    }
    else {
      await enterGallery(page)
    }
    const name = `retained-${crypto.randomUUID()}.txt`
    await page.getByLabel('Media file', { exact: true }).setInputFiles({
      name,
      mimeType: 'text/plain',
      buffer: Buffer.from('Retained file'),
    })
    const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.locator('.media-session-note')).toContainText('Uploads stay available')
    await assertAccessible(page, info, { label: `gallery-queue-retained-${width}` })
    await page.screenshot({ path: info.outputPath(`gallery-retained-queue-${width}.png`) })
    if (width === 320) {
      await page.getByRole('button', { name: 'Media library', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Tags', exact: true }).click()
    }
    else {
      await page.getByRole('link', { name: 'Tags', exact: true }).click()
    }
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    await page.goBack()
    await page.getByRole('button', { name: 'Upload media', exact: true }).click()
    await expect(dialog.getByRole('listitem').filter({ hasText: name })).toHaveAttribute('data-state', 'queued')
    await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
    await expect(dialog.getByRole('listitem').filter({ hasText: name })).toHaveAttribute('data-state', 'complete')
  })
}

test('gallery preserves one active transfer across browser Back and Forward', async ({ page }) => {
  await enterGallery(page)
  const name = `inflight-${crypto.randomUUID()}.txt`
  const payload = Buffer.from('Exactly one transfer')
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let transfers = 0
  await page.route('**/api/admin/assets/*/content', async (route) => {
    if (route.request().method() === 'PUT') {
      transfers++
      await held
    }
    await route.continue()
  })
  try {
    await page.getByLabel('Media file', { exact: true }).setInputFiles({
      name,
      mimeType: 'text/plain',
      buffer: payload,
    })
    const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
    await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
    await expect.poll(() => transfers).toBe(1)
    const length = await page.evaluate(() => history.length)
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    const warned = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    })
    expect(warned).toBe(true)
    await page.goForward()
    await expect(dialog).toBeVisible()
    const row = dialog.getByRole('listitem').filter({ hasText: name })
    await expect(row).toHaveAttribute('data-state', 'uploading')
    release()
    await expect(row).toHaveAttribute('data-state', 'complete')
    expect(transfers).toBe(1)
    expect(await page.evaluate(() => history.length)).toBe(length)
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    const gallery = page.getByRole('list', { name: 'Gallery', exact: true })
    await expect(gallery.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  finally { release() }
})

for (const outcome of ['committed', 'disconnected'] as const) {
  test(`gallery keeps its original ${outcome} upload retry after history navigation`, async ({ page }) => {
    await enterGallery(page)
    const name = `retained-retry-${crypto.randomUUID()}.txt`
    const payload = Buffer.from('Retry the original transfer')
    const { allocations, transfers } = await interruptTransfer(page, outcome, payload)
    await page.getByLabel('Media file', { exact: true }).setInputFiles({
      name,
      mimeType: 'text/plain',
      buffer: payload,
    })
    const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
    const row = dialog.getByRole('listitem').filter({ hasText: name })
    await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
    await expect(row).toHaveAttribute('data-state', 'failed')
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    const length = await page.evaluate(() => history.length)
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    await page.goForward()
    await page.getByRole('button', { name: 'Upload media', exact: true }).click()
    await expect(row).toHaveAttribute('data-state', 'failed')
    await row.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(row).toHaveAttribute('data-state', 'complete')
    expect(allocations).toHaveLength(1)
    expect(transfers).toHaveLength(outcome === 'committed' ? 1 : 2)
    expect(new Set(transfers).size).toBe(1)
    expect(await page.evaluate(() => history.length)).toBe(length)
  })
}

test('changed-owner renewal stops the batch and permits a fresh entry retry', async ({ page }) => {
  await enterGallery(page)
  let changed = false
  let allocations = 0
  let transfers = 0
  await page.route('**/api/admin/session', async (route) => {
    if (changed) {
      await route.fulfill({ json: { ownerSub: 'different-owner', csrfToken: 'different-owner-token' } })
    }
    else {
      await route.continue()
    }
  })
  await page.route('**/api/admin/assets', async (route) => {
    if (route.request().method() === 'POST') {
      allocations++
      changed = true
      await route.fulfill({ status: 403, json: { code: 'CSRF_INVALID' } })
    }
    else {
      await route.continue()
    }
  })
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/content')) {
      transfers++
    }
  })
  const names = [1, 2].map(index => `owner-bound-${index}-${crypto.randomUUID()}.txt`)
  await page.getByLabel('Media file', { exact: true }).setInputFiles(names.map(name => ({
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from('Original owner file'),
  })))
  await page.getByRole('button', { name: 'Upload files', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Your session expired')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(allocations).toBe(1)
  expect(transfers).toBe(0)
  await expect(page.getByRole('button', { name: 'Upload media', exact: true })).toBeDisabled()
  changed = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await page.getByRole('button', { name: 'Upload media', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('listitem')).toHaveCount(0)
  expect(allocations).toBe(1)
})

test('a cancelled entry check cannot expose or dispose retained files through a late response', async ({ page }) => {
  await enterGallery(page)
  const name = `private-queue-${crypto.randomUUID()}.txt`
  await page.getByLabel('Media file', { exact: true }).setInputFiles({
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from('Keep original selection'),
  })
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('link', { name: 'Tags', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let checks = 0
  await page.route('**/api/admin/session', async (route) => {
    checks++
    await held
    await route.fulfill({ json: { ownerSub: 'other-owner', csrfToken: 'other-token' } })
  })
  try {
    await page.goBack()
    await expect.poll(() => checks).toBe(1)
    await expect(page.getByText(name, { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Upload media', exact: true })).toHaveCount(0)
    await page.goForward()
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
    release()
    await page.unrouteAll({ behavior: 'wait' })
    await page.goBack()
    await page.getByRole('button', { name: 'Upload media', exact: true }).click()
    await expect(page.getByRole('listitem').filter({ hasText: name })).toHaveAttribute('data-state', 'queued')
    await expect(page.getByRole('alert')).toHaveCount(0)
  }
  finally { release() }
})
