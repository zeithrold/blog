import type { StubReply } from './publication-stub'
import type { MountedPublication } from './publication-support'
import { act } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { validateDocument } from '@/content/document'
import { saveSchema } from '@/contracts/documents'
import { scheduleCancelSchema } from '@/contracts/publication'
import {
  acceptSave,
  deferred,
  failure,
  publicationDocument,
  publicationSchedule,
  publicationServer,
  savedAhead,
  scheduleTimeReply,
} from './publication-stub'
import {
  advance,
  button,
  cancelControls,
  click,
  combobox,
  drainHostTask,
  mountPublication,
  openCombobox,
  option,
  resetDomPilot,
  scheduledBadge,
  text,
  texts,
  typeText,
} from './publication-support'

/*
 * Scheduling state and its notices: the real schedule controller, live list,
 * draft coordinator and schedule settings render here. Viewport, drawer and
 * picker interaction retain their component cases; this file proves the state,
 * the requests and the rendered explanations.
 */

afterEach(() => {
  vi.useRealTimers()
  resetDomPilot()
})

function deleteCalls(view: MountedPublication) {
  const path = `/api/admin/documents/${view.server.open.documentId}/schedule`
  return view.stub.calls.filter(call => call.method === 'DELETE' && call.path === path)
}

it('cancelling during a cross-tab conflict preserves both drafts', async () => {
  const loaded = publicationDocument('Scheduled boundary document')
  const external = savedAhead(loaded, 'Saved in another tab')
  const pending = publicationSchedule(loaded)
  const server = publicationServer(loaded, [pending])
  const view = mountPublication({ server })
  await view.load()
  expect(scheduledBadge(view.container)).toBe(true)
  // The other tab saved after this editor loaded; the production title path
  // marks the draft dirty and its 2s autosave meets the newer server version.
  server.open = external
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  view.editTitle('My unsaved conflicting title')
  await advance(2000)
  expect(view.state().workspace.draft.status).toBe('conflict')
  await act(async () => {
    click(button(view.container, 'Cancel schedule'))
    await view.state().settle()
  })
  expect(view.state().workspace.draft.status).toBe('conflict')
  expect(view.container.textContent).toContain('cancelled')
  expect(scheduledBadge(view.container)).toBe(false)
  expect(cancelControls(view.container)).toHaveLength(0)
  expect(view.state().workspace.model.envelope.meta.title).toBe('My unsaved conflicting title')
  // The client did not adopt the stale head from the conflicting save.
  expect(view.server.open.document.meta.title).toBe('Saved in another tab')
  expect(view.server.open.headRevisionId).toBe(external.headRevisionId)
  const cancels = deleteCalls(view)
  expect(cancels).toHaveLength(1)
  expect(scheduleCancelSchema.parse(cancels[0]?.body)).toEqual({
    scheduleId: pending.id,
    expectedVersion: external.version,
  })
})

it('cancelling a schedule preserves a draft rejected by autosave', async () => {
  let failSaves = true
  const open = publicationDocument('Scheduled boundary document')
  const pending = publicationSchedule(open)
  const server = publicationServer(open, [pending])
  const view = mountPublication({
    server,
    writes: {
      'PUT /api/admin/documents/:id/revisions': (call): StubReply => failSaves
        ? failure(422, 'INVALID_DOCUMENT')
        : acceptSave(server, call),
    },
  })
  await view.load()
  expect(scheduledBadge(view.container)).toBe(true)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  view.editTitle('Unsaved title to preserve')
  await advance(2000)
  const reason = 'The document failed validation. Check required fields, references and media settings, then retry.'
  expect(text(view.container, '.editor-notice[data-tone="error"]')).toContain(reason)
  await act(async () => {
    click(button(view.container, 'Cancel schedule'))
    await view.state().settle()
  })
  expect(scheduledBadge(view.container)).toBe(false)
  expect(view.container.textContent).toContain('cancelled')
  expect(cancelControls(view.container)).toHaveLength(0)
  expect(view.state().workspace.model.envelope.meta.title).toBe('Unsaved title to preserve')
  // Metadata cancellation does not resolve the refused autosave.
  expect(text(view.container, '.editor-notice[data-tone="error"]')).toContain(reason)
  failSaves = false
  view.editTitle('Corrected and saved title')
  await advance(2000)
  expect(view.container.querySelector('.save-status')?.getAttribute('data-status'))
    .toBe('saved')
  expect(view.container.querySelector('.editor-notice[data-tone="error"]')).toBeNull()
  const saves = view.stub.calls.filter(call => call.method === 'PUT')
  expect(validateDocument(saveSchema.parse(saves.at(-1)?.body).document).meta.title)
    .toBe('Corrected and saved title')
})

it('a delayed schedule refresh cannot restore a cancelled plan or its header badge', async () => {
  const open = publicationDocument('Delayed schedule refresh')
  const pending = publicationSchedule(open)
  const held = deferred<StubReply>()
  const requested = deferred<undefined>()
  let hold = false
  let captured: ReturnType<typeof publicationSchedule>[] = []
  const server = publicationServer(open, [pending])
  const view = mountPublication({
    server,
    writes: {
      'GET /api/admin/documents/:id/schedule': async () => {
        if (hold) {
          hold = false
          captured = structuredClone(server.items)
          requested.open(undefined)
          return await held.promise
        }
        return { body: { items: server.items } }
      },
    },
  })
  await view.load()
  expect(scheduledBadge(view.container)).toBe(true)
  hold = true
  await act(async () => {
    click(button(view.container, 'Load schedules'))
    await requested.promise
  })
  act(() => {
    click(button(view.container, 'Cancel schedule'))
  })
  await drainHostTask()
  expect(view.container.textContent).toContain('cancelled')
  expect(view.state().schedule.loading).toBe(false)
  // The held reply captured the plan before cancel; delivering it now must not
  // restore the plan or its badge.
  held.open({ body: { items: captured } })
  await act(async () => {
    await view.state().settle()
  })
  expect(view.state().schedule.loading).toBe(false)
  expect(view.state().schedule.items).toEqual([
    expect.objectContaining({ id: pending.id, state: 'cancelled' }),
  ])
  expect(scheduledBadge(view.container)).toBe(false)
  expect(cancelControls(view.container)).toHaveLength(0)
  expect(button(view.container, 'Load schedules').disabled).toBe(false)
})

it('timezone validation translates errors and ignores outdated failures', async () => {
  const open = publicationDocument('Timezone validation')
  const held = deferred<StubReply>()
  const requested = deferred<undefined>()
  let mode: 'ok' | 'invalid' | 'hold' = 'ok'
  const view = mountPublication({
    server: publicationServer(open),
    writes: {
      'GET /api/admin/schedule-time': async (call) => {
        if (mode === 'invalid') {
          return failure(400, 'TIMEZONE_INVALID')
        }
        if (mode === 'hold' && call.query.get('timezone') === 'UTC') {
          requested.open(undefined)
          return await held.promise
        }
        return scheduleTimeReply(call)
      },
    },
  })
  await view.load()
  const status = '.schedule-time-form [role="status"]'
  const time = new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  act(() => {
    view.state().schedule.update('localTime', time)
  })
  const timezone = await primeTimezone(view)
  mode = 'invalid'
  await checkTime(view)
  expect(text(view.container, status))
    .toBe('Enter a valid IANA timezone, such as Asia/Taipei or UTC.')
  mode = 'hold'
  await act(async () => {
    click(button(view.container, 'Check timezone and DST'))
    await requested.promise
  })
  await chooseTimezoneByKeyboard(view, 'Asia/Tokyo')
  expect(timezone.textContent).toContain('Asia/Tokyo')
  await checkTime(view)
  expect(text(view.container, status)).toBe('')
  expect(view.state().schedule.choices.length).toBeGreaterThan(0)
  expect(view.state().schedule.checking).toBe(false)
  held.open(failure(400, 'TIMEZONE_INVALID'))
  await act(async () => {
    await view.state().settle()
  })
  expect(text(view.container, status)).toBe('')
  expect(view.state().schedule.checking).toBe(false)
  await chooseVerified(view)
  expect(button(view.container, 'Schedule saved draft').disabled).toBe(false)
})

async function primeTimezone(view: MountedPublication): Promise<HTMLElement> {
  const timezone = combobox(view.container, 'Publication timezone')
  const deviceZone = new Intl.DateTimeFormat().resolvedOptions().timeZone
  const timeRequests = () =>
    view.stub.calls.filter(call => call.path === '/api/admin/schedule-time')
  expect(timezone.textContent).toContain(deviceZone)
  openCombobox(timezone)
  typeText(combobox(document, 'Search cities or timezones'), 'Invalid/Zone')
  expect(document.body.textContent).toContain('No matching timezone.')
  expect(timeRequests()).toHaveLength(0)
  await chooseTimezone(view, 'UTC')
  expect(timezone.textContent).toContain('UTC')
  openCombobox(timezone)
  act(() => {
    click(button(document, 'Use device timezone'))
  })
  await drainHostTask()
  expect(timezone.textContent).toContain(deviceZone)
  await chooseTimezoneByKeyboard(view, 'UTC')
  expect(timezone.textContent).toContain('UTC')
  expect(timeRequests()).toHaveLength(0)
  expect(view.stub.calls.filter(call => call.method !== 'GET' && call.method !== 'HEAD'))
    .toEqual([])
  return timezone
}

async function chooseTimezone(view: MountedPublication, timezone: string): Promise<void> {
  openCombobox(combobox(view.container, 'Publication timezone'))
  typeText(combobox(document, 'Search cities or timezones'), timezone)
  act(() => {
    click(option(document, timezone))
  })
  await drainHostTask()
}

async function chooseTimezoneByKeyboard(
  view: MountedPublication,
  timezone: string,
): Promise<void> {
  openCombobox(combobox(view.container, 'Publication timezone'))
  const search = combobox(document, 'Search cities or timezones')
  typeText(search, timezone)
  for (const key of ['ArrowDown', 'Enter']) {
    act(() => {
      search.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      }))
    })
  }
  await drainHostTask()
}

async function checkTime(view: MountedPublication): Promise<void> {
  act(() => {
    click(button(view.container, 'Check timezone and DST'))
  })
  await drainHostTask()
}

async function chooseVerified(view: MountedPublication): Promise<void> {
  openCombobox(combobox(view.container, 'Verified UTC time'))
  act(() => {
    click(option(document, 'UTC offset'))
  })
  await drainHostTask()
}

it('refreshing a failed plan updates the header and translates its rejection code', async () => {
  const open = publicationDocument('Failed plan')
  const pending = publicationSchedule(open)
  const server = publicationServer(open, [pending])
  const view = mountPublication({ server })
  await view.load()
  expect(scheduledBadge(view.container)).toBe(true)
  server.items = [
    publicationSchedule(open, {
      state: 'failed',
      attempts: 1,
      errorCode: 'PUBLICATION_CONFLICT',
    }),
  ]
  await act(async () => {
    click(button(view.container, 'Load schedules'))
    await view.state().settle()
  })
  expect(text(view.container, '.schedule-error'))
    .toBe('A slug or series position is already in use. Check the conflicting entry.')
  expect(scheduledBadge(view.container)).toBe(false)
  expect(texts(view.container, '.schedule-list [data-slot="badge"]')).toContain('failed')
})
