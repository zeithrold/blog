import type { MountedPublication } from './publication-remaining-support'
import type { StubReply } from './publication-stub'
import { act } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { validateDocument } from '@/content/document'
import { saveSchema } from '@/contracts/documents'
import { scheduleCancelSchema, scheduleTimeSchema } from '@/contracts/publication'
import {
  acceptSave,
  advance,
  attachTitleInput,
  button,
  cancelControls,
  click,
  clickAndSettle,
  combobox,
  deferred,
  drainHostTask,
  failure,
  field,
  mountPublication,
  openCombobox,
  option,
  publicationDocument,
  publicationSchedule,
  publicationServer,
  resetDomPilot,
  savedAhead,
  scheduledBadge,
  text,
  typeText,
} from './publication-remaining-support'

afterEach(() => {
  vi.useRealTimers()
  resetDomPilot()
})

function calls(view: MountedPublication, method: string, path: string) {
  return view.stub.calls.filter(call => call.method === method && call.path === path)
}

it('cancelling during a cross-tab conflict preserves both drafts', async () => {
  const loaded = publicationDocument('Scheduled boundary document')
  const external = savedAhead(loaded, 'Saved in another tab')
  const pending = publicationSchedule(loaded)
  const server = publicationServer(loaded, [pending])
  const view = mountPublication({
    server,
    header: { livePath: () => server.open.livePath },
    writes: {
      'PUT /api/admin/documents/:id/revisions': () => failure(409, 'EDIT_CONFLICT'),
    },
  })
  await view.load()
  expect(scheduledBadge(view.container)).toBe(true)
  server.open = external
  const title = attachTitleInput(view)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  typeText(title, 'My unsaved conflicting title')
  await advance(2000)
  await view.settle()
  expect(view.state().workspace.draft.status).toBe('conflict')

  await clickAndSettle(view, button(view.container, 'Cancel schedule'))
  expect(view.state().workspace.draft.status).toBe('conflict')
  expect(view.container.textContent).toContain('cancelled')
  expect(scheduledBadge(view.container)).toBe(false)
  expect(cancelControls(view.container)).toHaveLength(0)
  expect(view.state().workspace.model.envelope.meta.title).toBe('My unsaved conflicting title')

  const cancels = calls(
    view,
    'DELETE',
    `/api/admin/documents/${loaded.documentId}/schedule`,
  )
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
    header: { livePath: () => server.open.livePath },
    writes: {
      'PUT /api/admin/documents/:id/revisions': (call): StubReply => failSaves
        ? failure(422, 'INVALID_DOCUMENT')
        : acceptSave(server, call),
    },
  })
  await view.load()
  expect(scheduledBadge(view.container)).toBe(true)
  const title = attachTitleInput(view)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  typeText(title, 'Unsaved title to preserve')
  await advance(2000)
  await view.settle()
  const reason = 'The document failed validation. Check required fields, references and media settings, then retry.'
  expect(text(view.container, '.editor-notice[data-tone="error"]')).toContain(reason)

  await clickAndSettle(view, button(view.container, 'Cancel schedule'))
  expect(scheduledBadge(view.container)).toBe(false)
  expect(view.container.textContent).toContain('cancelled')
  expect(cancelControls(view.container)).toHaveLength(0)
  expect(view.state().workspace.model.envelope.meta.title).toBe('Unsaved title to preserve')
  expect(text(view.container, '.editor-notice[data-tone="error"]')).toContain(reason)

  failSaves = false
  typeText(title, 'Corrected and saved title')
  await advance(2000)
  await view.settle()
  expect(view.container.querySelector('.save-status')?.getAttribute('data-status'))
    .toBe('saved')
  expect(view.container.querySelector('.editor-notice[data-tone="error"]')).toBeNull()
  const saves = view.stub.calls.filter(call => call.method === 'PUT')
  expect(saveDocumentTitle(saves.at(-1)?.body)).toBe('Corrected and saved title')
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
    header: { livePath: () => server.open.livePath },
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
  expect(view.state().schedule.items).toEqual([
    expect.objectContaining({ id: pending.id, state: 'cancelled' }),
  ])
  expect(cancelControls(view.container)).toHaveLength(0)
  expect(scheduledBadge(view.container)).toBe(false)

  try {
    held.open({ body: { items: captured } })
    await view.settle()
  }
  finally {
    held.open({ body: { items: captured } })
  }
  expect(view.state().schedule.items).toEqual([
    expect.objectContaining({ id: pending.id, state: 'cancelled' }),
  ])
  expect(scheduledBadge(view.container)).toBe(false)
  expect(button(view.container, 'Load schedules').disabled).toBe(false)
})

function assertUnknownTimezoneFiltersLocally(view: MountedPublication): void {
  typeText(field(view.container, 'Publication time'), '09:00')
  openCombobox(combobox(view.container, 'Publication timezone'))
  typeText(combobox(document, 'Search cities or timezones'), 'Invalid/Zone')
  expect(document.body.textContent).toContain('No matching timezone.')
  expect(calls(view, 'GET', '/api/admin/schedule-time')).toHaveLength(0)
}

async function chooseTimezone(view: MountedPublication, timezone: string): Promise<void> {
  openCombobox(combobox(view.container, 'Publication timezone'))
  typeText(combobox(document, 'Search cities or timezones'), timezone)
  act(() => {
    click(option(document, timezone))
  })
  await drainHostTask()
}

it('timezone validation translates status and ignores outdated failures', async () => {
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
        return {
          body: scheduleTimeSchema.parse({
            choices: [
              { runAt: 1893456000000, utcOffset: 0 },
            ],
          }),
        }
      },
    },
  })
  await view.load()
  assertUnknownTimezoneFiltersLocally(view)
  await chooseTimezone(view, 'UTC')
  mode = 'invalid'
  const status = '.schedule-time-form [role="status"]'
  await clickAndSettle(view, button(view.container, 'Check timezone and DST'))
  expect(text(view.container, status))
    .toBe('Enter a valid IANA timezone, such as Asia/Taipei or UTC.')

  mode = 'hold'
  await act(async () => {
    click(button(view.container, 'Check timezone and DST'))
    await requested.promise
  })
  await chooseTimezone(view, 'Asia/Tokyo')
  act(() => {
    click(button(view.container, 'Check timezone and DST'))
  })
  await drainHostTask()
  expect(view.state().schedule.choices).toHaveLength(1)
  expect(text(view.container, status)).toBe('')
  expect(view.state().schedule.checking).toBe(false)
  held.open(failure(400, 'TIMEZONE_INVALID'))
  await view.settle()
  expect(text(view.container, status)).toBe('')
  expect(view.state().schedule.checking).toBe(false)

  openCombobox(combobox(view.container, 'Verified UTC time'))
  act(() => {
    click(option(document, 'UTC offset'))
  })
  await drainHostTask()
  expect(button(view.container, 'Schedule saved draft').disabled).toBe(false)
})

it('refreshing a failed plan translates its rejection and removes the header badge', async () => {
  const open = publicationDocument('Failed plan')
  const pending = publicationSchedule(open)
  const failed = publicationSchedule(open, {
    state: 'failed',
    attempts: 1,
    errorCode: 'PUBLICATION_CONFLICT',
  })
  const server = publicationServer(open, [pending])
  const view = mountPublication({
    server,
    header: { livePath: () => server.open.livePath },
  })
  await view.load()
  expect(scheduledBadge(view.container)).toBe(true)
  server.items = [failed]
  await clickAndSettle(view, button(view.container, 'Load schedules'))
  expect(text(view.container, '.schedule-error'))
    .toBe('A slug or series position is already in use. Check the conflicting entry.')
  expect(scheduledBadge(view.container)).toBe(false)
  expect(view.container.textContent).toContain('failed')
})

it('failed schedule explanation renders in zh-CN', async () => {
  const open = publicationDocument('Chinese failed plan')
  const failed = publicationSchedule(open, {
    state: 'failed',
    attempts: 1,
    errorCode: 'PUBLICATION_CONFLICT',
  })
  const view = mountPublication({
    server: publicationServer(open, [failed]),
    locale: 'zh-CN',
    header: { livePath: () => null },
  })
  await view.load()
  expect(text(view.container, '.schedule-error')).toBe('路径或系列位置已被占用，请检查冲突项。')
})

function saveDocumentTitle(body: unknown): string {
  return validateDocument(saveSchema.parse(body).document).meta.title
}
