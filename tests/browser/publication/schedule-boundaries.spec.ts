import type { Page } from '@playwright/test'
import { openDocumentSchema, sessionSchema } from '@/content/contracts'
import { emptyDocument } from '@/content/document'
import { scheduleListSchema } from '@/content/service-contracts'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { setChinese } from '~/tests/support/browser/locale'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'
import { chooseTimezone, publicationTime, verifiedTime } from './schedule-helpers'

async function scheduleForm(page: Page): Promise<void> {
  await settingsTab(page, 'Publication')
  const section = page.getByRole('button', { name: 'Scheduled publication', exact: true })
  if (await section.getAttribute('aria-expanded') === 'false') {
    await section.click()
  }
}

async function prepare(page: Page) {
  const document = emptyDocument()
  document.meta.title = 'Scheduled boundary document'
  document.meta.slug = `schedule-boundary-${crypto.randomUUID()}`
  const ack = await writeDocument(page, document)
  await scheduleForm(page)
  await publicationTime(page, new Date(Date.now() + 86400000).toISOString().slice(0, 16))
  await chooseTimezone(page, 'UTC')
  return ack
}

async function createSchedule(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Check timezone and DST', exact: true }).click()
  await verifiedTime(page)
  await page.getByRole('button', { name: 'Schedule saved draft', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cancel schedule', exact: true })).toBeVisible()
}

async function closeSettings(page: Page): Promise<void> {
  const drawer = page.getByRole('dialog', { name: 'Document settings', exact: true })
  if (await drawer.isVisible()) {
    await drawer.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(drawer).toHaveCount(0)
  }
}

test('cancelling during a cross-tab conflict preserves both drafts', async ({ page }) => {
  const ack = await prepare(page)
  await createSchedule(page)
  await closeSettings(page)
  const path = `/api/admin/documents/${ack.documentId}`
  const latest = openDocumentSchema.parse(await (await page.request.get(path)).json())
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  latest.document.meta.title = 'Saved in another tab'
  const external = await page.request.put(`${path}/revisions`, {
    headers: {
      'origin': new URL(page.url()).origin,
      'x-csrf-token': session.csrfToken,
      'idempotency-key': crypto.randomUUID(),
    },
    data: {
      expectedVersion: latest.version,
      baseRevisionId: latest.headRevisionId,
      reason: 'manual',
      document: latest.document,
    },
  })
  expect(external.ok()).toBe(true)
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('My unsaved conflicting title')
  await expect(page.locator('.save-status')).toContainText('Conflict')
  await scheduleForm(page)
  await page.getByRole('button', { name: 'Cancel schedule', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cancel schedule', exact: true })).toHaveCount(0)
  await expect(page.locator('.save-status')).toContainText('Conflict')
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('My unsaved conflicting title')
  const current = openDocumentSchema.parse(await (await page.request.get(path)).json())
  expect(current.document.meta.title).toBe('Saved in another tab')
  expect(current.headRevisionId).not.toBe(ack.headRevisionId)
})

for (const width of [1440, 390]) {
  test(`cancelling a schedule preserves a draft rejected by autosave at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const ack = await prepare(page)
    await createSchedule(page)
    await closeSettings(page)
    const path = `/api/admin/documents/${ack.documentId}`
    await page.route(`**${path}/revisions`, async (route) => {
      await route.fulfill({ status: 422, json: { code: 'INVALID_DOCUMENT' } })
    })
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Unsaved title to preserve')
    await expect(page.locator('.editor-notice[data-tone="error"]')).toBeVisible()
    await scheduleForm(page)
    const cancelled = page.waitForResponse(response => response.url().endsWith('/schedule')
      && response.request().method() === 'DELETE')
    await page.getByRole('button', { name: 'Cancel schedule', exact: true }).click()
    expect((await cancelled).status()).toBe(200)
    await expect(page.getByRole('button', { name: 'Cancel schedule', exact: true })).toHaveCount(0)
    await expect(page.locator('.workspace-status').getByText('Scheduled', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`schedule-cancel-unsaved-${width}.png`) })
    await closeSettings(page)
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Unsaved title to preserve')
    await page.unroute(`**${path}/revisions`)
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Corrected and saved title')
    await saved(page)
    const response = await page.request.get(path)
    expect(await response.json()).toMatchObject({ document: { meta: { title: 'Corrected and saved title' } } })
  })
}

test('a delayed schedule refresh cannot restore a cancelled plan or its header badge', async ({ page }) => {
  await prepare(page)
  await createSchedule(page)
  let release = (): void => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let started = (): void => {}
  const requested = new Promise<void>((resolve) => {
    started = resolve
  })
  let completed = (): void => {}
  const delivered = new Promise<void>((resolve) => {
    completed = resolve
  })
  let first = true
  await page.route('**/schedule?*', async (route) => {
    if (first) {
      first = false
      const response = await route.fetch()
      started()
      await gate
      await route.fulfill({ response })
      completed()
    }
    else {
      await route.continue()
    }
  })
  await page.getByRole('button', { name: 'Load schedules', exact: true }).click()
  await requested
  try {
    await page.getByRole('button', { name: 'Cancel schedule', exact: true }).click()
    await expect(page.locator('.schedule-list')).toContainText('cancelled')
  }
  finally {
    release()
  }
  await delivered
  await page.evaluate(async () => await new Promise(requestAnimationFrame))
  await expect(page.getByRole('button', { name: 'Load schedules', exact: true })).toBeEnabled()
  await expect(page.locator('.schedule-list')).toContainText('cancelled')
  await expect(page.getByRole('button', { name: 'Cancel schedule', exact: true })).toHaveCount(0)
  await expect(page.locator('.workspace-status').getByText('Scheduled', { exact: true })).toHaveCount(0)
})

test('timezone validation explains errors locally and ignores outdated failures', async ({ page }, info) => {
  await prepare(page)
  const timezone = page.getByRole('combobox', { name: 'Publication timezone', exact: true })
  const check = page.getByRole('button', { name: 'Check timezone and DST', exact: true })
  await timezone.click()
  const search = page.getByRole('combobox', { name: 'Search cities or timezones', exact: true })
  await search.fill('Invalid/Zone')
  await expect(page.getByText('No matching timezone.', { exact: true })).toBeVisible()
  await search.press('Escape')
  await expect(timezone).toContainText('UTC')
  await page.route('**/schedule-time?*', async route =>
    await route.fulfill({ status: 400, json: { code: 'TIMEZONE_INVALID' } }))
  await check.click()
  const notice = page.locator('.schedule-time-form').getByRole('status', { includeHidden: true })
  await expect(notice).toHaveText('Enter a valid IANA timezone, such as Asia/Taipei or UTC.')
  await page.screenshot({ path: info.outputPath('schedule-timezone-error.png') })
  await page.unroute('**/schedule-time?*')
  let release = (): void => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let started = (): void => {}
  const requested = new Promise<void>((resolve) => {
    started = resolve
  })
  let completed = (): void => {}
  const delivered = new Promise<void>((resolve) => {
    completed = resolve
  })
  await page.route('**/schedule-time?*', async (route) => {
    if (new URL(route.request().url()).searchParams.get('timezone') === 'UTC') {
      started()
      await gate
      await route.fulfill({ status: 400, json: { code: 'TIMEZONE_INVALID' } })
      completed()
    }
    else {
      await route.continue()
    }
  })
  await check.click()
  await requested
  try {
    await chooseTimezone(page, 'Asia/Tokyo')
    await check.click()
    await verifiedTime(page)
  }
  finally {
    release()
  }
  await delivered
  await page.evaluate(async () => await new Promise(requestAnimationFrame))
  await expect(notice).toBeEmpty()
  await expect(page.locator('.editor-notice[data-tone="error"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Schedule saved draft', exact: true })).toBeEnabled()
})

test('refreshing a failed plan updates the header and translates its rejection code', async ({ page }, info) => {
  await prepare(page)
  await createSchedule(page)
  await page.route('**/schedule?*', async (route) => {
    const response = await route.fetch()
    const data = scheduleListSchema.parse(await response.json())
    await route.fulfill({ json: {
      items: data.items.map(item => ({ ...item, state: 'failed', attempts: 1, errorCode: 'PUBLICATION_CONFLICT' })),
    } })
  })
  await page.getByRole('button', { name: 'Load schedules', exact: true }).click()
  await expect(page.locator('.schedule-error'))
    .toHaveText('A slug or series position is already in use. Check the conflicting entry.')
  await expect(page.locator('.workspace-status').getByText('Scheduled', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('schedule-job-error.png') })
})

test('failed schedule explanations fit the Chinese mobile drawer', async ({ page }, info) => {
  await prepare(page)
  await createSchedule(page)
  await page.route('**/schedule?*', async (route) => {
    const response = await route.fetch()
    const data = scheduleListSchema.parse(await response.json())
    await route.fulfill({ json: {
      items: data.items.map(item => ({ ...item, state: 'failed', attempts: 1, errorCode: 'PUBLICATION_CONFLICT' })),
    } })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await setChinese(page)
  await page.getByRole('button', { name: '文档设置', exact: true }).click()
  await page.getByRole('tab', { name: '发布', exact: true }).click()
  await page.getByRole('button', { name: '定时发布', exact: true }).click()
  const error = page.locator('.schedule-error')
  await expect(error).toHaveText('路径或系列位置已被占用，请检查冲突项。')
  await error.scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('schedule-failed-390-zh.png') })
})
