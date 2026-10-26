import type { Page } from '@playwright/test'
import type { ApiService } from '../support/http-fixtures'
import type { PublicationCopy } from '../support/publication-remaining'
import { chooseTimezone, publicationTime, verifiedTime } from '~/tests/browser/publication/schedule-helpers'
import { editorReady } from '../support/editor-workspace-ui'
import { apiKey, defer, failure } from '../support/http-fixtures'
import { closeSettings, openScheduleForm, publicationCopy } from '../support/publication-remaining'
import {
  acceptSave,
  mountPublicationWorkspace,
  publicationDocument,
  publicationSchedule,
  publicationState,
  savedAhead,
  savedTitleOf,
  scheduleTimeReply,
} from '../support/publication-remaining-server'
import { expect, test } from '../support/test'

/** The pending plan badge the header renders beside the publication state. */
function scheduledBadge(page: Page): ReturnType<Page['locator']> {
  return page.locator('.workspace-status').getByText(publicationCopy.en.scheduledBadge, { exact: true })
}

function lastWrite(api: ApiService, route: string) {
  const call = api.calls.filter(entry => apiKey(entry.method, entry.path) === route).at(-1)
  if (call === undefined) {
    throw new Error(`No ${route} request was sent`)
  }
  return call
}

/** The picker filters unknown zones locally, without a schedule-time request. */
async function localTimezoneFilter(page: Page, copy: PublicationCopy): Promise<void> {
  const timezone = page.getByRole('combobox', { name: copy.timezone, exact: true })
  await timezone.click()
  const search = page.getByRole('combobox', { name: copy.search, exact: true })
  await search.fill('Invalid/Zone')
  await expect(page.getByText(copy.noTimezone, { exact: true })).toBeVisible()
  await search.press('Escape')
}

test('cancelling during a cross-tab conflict preserves both drafts', async ({ page }) => {
  const loaded = publicationDocument('Scheduled boundary document')
  const external = savedAhead(loaded, 'Saved in another tab')
  const pending = publicationSchedule(loaded)
  const state = publicationState(loaded, [pending])
  const api = await mountPublicationWorkspace(page, { state, width: 1440 })
  const copy = publicationCopy.en
  try {
    await editorReady(page)
    await expect(scheduledBadge(page)).toHaveCount(1)
    // The other tab saved after this editor loaded; the local draft is dirty.
    state.open = external
    const title = page.getByLabel(copy.title, { exact: true })
    await title.fill('My unsaved conflicting title')
    await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'conflict')
    await openScheduleForm(page)
    await page.getByRole('button', { name: copy.cancelSchedule, exact: true }).click()
    await expect(page.getByRole('button', { name: copy.cancelSchedule, exact: true })).toHaveCount(0)
    await expect(scheduledBadge(page)).toHaveCount(0)
    await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'conflict')
    await expect(title).toHaveValue('My unsaved conflicting title')
    expect(state.open.document.meta.title).toBe('Saved in another tab')
    expect(state.open.headRevisionId).toBe(external.headRevisionId)
    const cancel = api.calls.find(call =>
      apiKey(call.method, call.path) === 'DELETE /api/admin/documents/:id/schedule')
    expect(cancel?.json).toEqual({ scheduleId: pending.id, expectedVersion: external.version })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

for (const width of [1440, 390]) {
  test(`cancelling a schedule preserves a draft rejected by autosave at ${width}px`, async ({ page }) => {
    const open = publicationDocument('Scheduled boundary document')
    const pending = publicationSchedule(open)
    const state = publicationState(open, [pending])
    let failSaves = true
    const api = await mountPublicationWorkspace(page, {
      state,
      width,
      writes: {
        'PUT /api/admin/documents/:id/revisions': call => failSaves
          ? failure(422, 'INVALID_DOCUMENT')
          : acceptSave(state, call),
      },
    })
    const copy = publicationCopy.en
    try {
      await editorReady(page)
      await expect(scheduledBadge(page)).toHaveCount(1)
      const title = page.getByLabel(copy.title, { exact: true })
      await title.fill('Unsaved title to preserve')
      await expect(page.locator('.editor-notice[data-tone="error"]')).toBeVisible()
      await openScheduleForm(page)
      await page.getByRole('button', { name: copy.cancelSchedule, exact: true }).click()
      await expect(page.getByRole('button', { name: copy.cancelSchedule, exact: true })).toHaveCount(0)
      await expect(scheduledBadge(page)).toHaveCount(0)
      await closeSettings(page)
      await expect(title).toHaveValue('Unsaved title to preserve')
      failSaves = false
      await title.fill('Corrected and saved title')
      await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'saved')
      await expect(page.locator('.editor-notice[data-tone="error"]')).toHaveCount(0)
      expect(savedTitleOf(lastWrite(api, 'PUT /api/admin/documents/:id/revisions')))
        .toBe('Corrected and saved title')
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('a delayed schedule refresh cannot restore a cancelled plan or its header badge', async ({ page }) => {
  const open = publicationDocument('Delayed schedule refresh')
  const pending = publicationSchedule(open)
  const state = publicationState(open, [pending])
  const held = defer()
  let holdNext = false
  let started: () => void = () => {}
  const requested = new Promise<void>((resolve) => {
    started = resolve
  })
  const api = await mountPublicationWorkspace(page, {
    state,
    writes: {
      'GET /api/admin/documents/:id/schedule': async () => {
        if (holdNext) {
          holdNext = false
          const captured = structuredClone(state.items)
          started()
          await held.promise
          return { body: { items: captured } }
        }
        return { body: { items: state.items } }
      },
    },
  })
  const copy = publicationCopy.en
  try {
    await editorReady(page)
    await expect(scheduledBadge(page)).toHaveCount(1)
    await openScheduleForm(page)
    holdNext = true
    await page.getByRole('button', { name: copy.loadSchedules, exact: true }).click()
    await requested
    await page.getByRole('button', { name: copy.cancelSchedule, exact: true }).click()
    await expect(page.locator('.schedule-list')).toContainText('cancelled')
    held.open()
    await api.settle()
    await page.evaluate(async () => await new Promise(requestAnimationFrame))
    await expect(page.getByRole('button', { name: copy.loadSchedules, exact: true })).toBeEnabled()
    await expect(page.locator('.schedule-list')).toContainText('cancelled')
    await expect(page.getByRole('button', { name: copy.cancelSchedule, exact: true })).toHaveCount(0)
    await expect(scheduledBadge(page)).toHaveCount(0)
    await api.expectServed()
  }
  finally {
    held.open()
    await api.dispose()
  }
})

test('timezone validation explains errors locally and ignores outdated failures', async ({ page }, info) => {
  const open = publicationDocument('Timezone validation')
  const state = publicationState(open)
  const held = defer()
  let mode: 'ok' | 'invalid' | 'hold' = 'ok'
  let started: () => void = () => {}
  const requested = new Promise<void>((resolve) => {
    started = resolve
  })
  const api = await mountPublicationWorkspace(page, {
    state,
    writes: {
      'GET /api/admin/schedule-time': async (call) => {
        if (mode === 'invalid') {
          return failure(400, 'TIMEZONE_INVALID')
        }
        if (mode === 'hold' && call.query.get('timezone') === 'UTC') {
          started()
          await held.promise
          return failure(400, 'TIMEZONE_INVALID')
        }
        return scheduleTimeReply(call)
      },
    },
  })
  const copy = publicationCopy.en
  try {
    await editorReady(page)
    await openScheduleForm(page)
    await publicationTime(page, new Date(Date.now() + 86400000).toISOString().slice(0, 16))
    await chooseTimezone(page, 'UTC')
    const timezone = page.getByRole('combobox', { name: copy.timezone, exact: true })
    await localTimezoneFilter(page, copy)
    await expect(timezone).toContainText('UTC')
    mode = 'invalid'
    await page.getByRole('button', { name: copy.checkTime, exact: true }).click()
    const notice = page.locator('.schedule-time-form').getByRole('status', { includeHidden: true })
    await expect(notice).toHaveText(copy.timezoneError)
    await page.screenshot({ path: info.outputPath('schedule-timezone-error.png') })
    mode = 'hold'
    await page.getByRole('button', { name: copy.checkTime, exact: true }).click()
    await requested
    await chooseTimezone(page, 'Asia/Tokyo')
    await expect(timezone).toContainText('Asia/Tokyo')
    await page.getByRole('button', { name: copy.checkTime, exact: true }).click()
    await verifiedTime(page)
    held.open()
    await api.settle()
    await page.evaluate(async () => await new Promise(requestAnimationFrame))
    await expect(notice).toBeEmpty()
    await expect(page.locator('.editor-notice[data-tone="error"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: copy.scheduleSavedDraft, exact: true })).toBeEnabled()
    await api.expectServed()
  }
  finally {
    held.open()
    await api.dispose()
  }
})

test('refreshing a failed plan updates the header and translates its rejection code', async ({ page }, info) => {
  const open = publicationDocument('Failed plan')
  const pending = publicationSchedule(open)
  const state = publicationState(open, [pending])
  let failed = false
  const api = await mountPublicationWorkspace(page, {
    state,
    writes: {
      'GET /api/admin/documents/:id/schedule': () => ({
        body: {
          items: failed
            ? state.items.map(item => ({
                ...item,
                state: 'failed',
                attempts: 1,
                errorCode: 'PUBLICATION_CONFLICT',
              }))
            : state.items,
        },
      }),
    },
  })
  const copy = publicationCopy.en
  try {
    await editorReady(page)
    await expect(scheduledBadge(page)).toHaveCount(1)
    await openScheduleForm(page)
    failed = true
    await page.getByRole('button', { name: copy.loadSchedules, exact: true }).click()
    await expect(page.locator('.schedule-error')).toHaveText(copy.scheduleError)
    await expect(scheduledBadge(page)).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('schedule-job-error.png') })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('failed schedule explanations fit the Chinese mobile drawer', async ({ page }, info) => {
  const open = publicationDocument('Chinese failed plan')
  const failed = publicationSchedule(open, {
    state: 'failed',
    attempts: 1,
    errorCode: 'PUBLICATION_CONFLICT',
  })
  const state = publicationState(open, [failed])
  const api = await mountPublicationWorkspace(page, { state, width: 390, locale: 'zh' })
  const copy = publicationCopy.zh
  try {
    await editorReady(page, 'zh')
    await openScheduleForm(page, 'zh')
    const error = page.locator('.schedule-error')
    await expect(error).toHaveText(copy.scheduleError)
    await error.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('schedule-failed-390-zh.png') })
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
