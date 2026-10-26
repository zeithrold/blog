import type { ApiHandler } from './http'
import type { OpenDocument } from '@/contracts/documents'
import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { acknowledgementSchema, saveSchema } from '@/contracts/documents'
import {
  scheduleAckSchema,
  scheduleItemSchema,
  scheduleListSchema,
  scheduleTimeSchema,
} from '@/contracts/publication'
import { catalogEntry, catalogPage } from '~/tests/components/support/domain-fixtures'
import { editorWorkspaceDocument } from '~/tests/components/support/editor-workspace-fixtures'
import {
  all,
  button,
  click,
  combobox,
  field,
  one,
  openCombobox,
  option,
  press,
  typeText,
} from './dom'
import { mountEditorChrome, resetEditorChrome } from './editor-chrome-support'
import { until } from './environment'
import { defer } from './http'

afterEach(resetEditorChrome)

async function selectScheduleDate(root: ParentNode): Promise<void> {
  const date = root.querySelector<HTMLButtonElement>('button[aria-label="Publication date"]')
  if (date === null) {
    throw new Error('The publication date picker is missing')
  }
  act(() => click(date))
  await act(async () => {
    await until(() => document.body.querySelector('.app-calendar') !== null)
  })
  const year = combobox(document.body, 'Choose year')
  await act(async () => {
    openCombobox(year)
    await until(() => document.body.querySelector('[role="option"]') !== null)
  })
  act(() => click(option(document.body, '2099')))
  const month = combobox(document.body, 'Choose month')
  await act(async () => {
    openCombobox(month)
    await until(() => document.body.querySelector('[role="option"]') !== null)
  })
  act(() => click(option(document.body, 'May')))
  const day = all<HTMLButtonElement>(document.body, '.app-calendar .rdp-day-button')
    .find(item => item.textContent.trim() === '1')
  if (day === undefined) {
    throw new Error('The selected month has no first day')
  }
  act(() => click(day))
}

async function chooseVerifiedScheduleTime(
  root: ParentNode,
  view: Awaited<ReturnType<typeof mountEditorChrome>>,
  requested: ReturnType<typeof defer>,
): Promise<void> {
  await act(async () => {
    click(button(root, 'Check timezone and DST'))
    await requested.promise
    await view.api.settle()
  })
  const verified = combobox(root, 'Verified UTC time')
  await act(async () => {
    openCombobox(verified)
    await until(() => document.body.querySelector('[role="option"]') !== null)
  })
  act(() => click(option(document.body, '2099-05-01T01:30:00.000Z')))
}

function scheduleHandlers(input: {
  initial: OpenDocument
  pendingItem: ReturnType<typeof scheduleItemSchema.parse>
  scheduleId: string
  started: ReturnType<typeof defer>
  release: ReturnType<typeof defer>
  timeRequested: ReturnType<typeof defer>
}): Record<string, ApiHandler> {
  let scheduled = false
  return {
    'GET /api/admin/documents/:id/schedule': () => {
      const items = scheduled
        ? [input.pendingItem]
        : []
      return { body: scheduleListSchema.parse({ items }) }
    },
    'GET /api/admin/schedule-time': () => {
      input.timeRequested.open()
      return {
        body: scheduleTimeSchema.parse({
          choices: [
            { runAt: input.pendingItem.runAt, utcOffset: 0 },
          ],
        }),
      }
    },
    'POST /api/admin/documents/:id/schedule': async () => {
      input.started.open()
      await input.release.promise
      scheduled = true
      return {
        body: scheduleAckSchema.parse({
          documentId: input.initial.documentId,
          version: 1,
          headRevisionId: input.initial.headRevisionId,
          liveRevisionId: null,
          liveGeneration: 0,
          scheduleId: input.scheduleId,
          state: 'pending',
        }),
      }
    },
  }
}

async function syncThroughDocumentActions(view: Awaited<ReturnType<typeof mountEditorChrome>>): Promise<void> {
  const more = one<HTMLButtonElement>(
    view.container,
    '.workspace-actions button[aria-label="More document actions"]',
  )
  await act(async () => {
    press(more, 'Enter')
    await until(() => document.body.querySelector('[role="menu"]') !== null)
  })
  const sync = all<HTMLDivElement>(document.body, '[role="menuitem"]')
    .find(item => item.textContent.trim() === 'Sync draft now')
  if (sync === undefined) {
    throw new Error('The sync action is missing')
  }
  await act(async () => {
    press(sync, 'Enter')
    await view.api.expectServed()
  })
}

it('catalog selections enter the editor snapshot that the real draft client sends', async () => {
  const initial = editorWorkspaceDocument('Catalog snapshot')
  const tag = catalogEntry({ kind: 'tag', name: 'Snapshot tag', slug: 'snapshot-tag' })
  const view = await mountEditorChrome({
    initial,
    handlers: {
      'GET /api/admin/catalog/tag': () => ({ body: catalogPage([tag]) }),
      'PUT /api/admin/documents/:id/revisions': () => ({
        body: acknowledgementSchema.parse({
          documentId: initial.documentId,
          version: 1,
          headRevisionId: 'b5f67d29-cc23-4b90-8a4c-d92bed4cb3c0',
          liveRevisionId: null,
          liveGeneration: 0,
        }),
      }),
    },
  })

  act(() => click(button(view.container, 'Tags and series')))
  const tags = combobox(view.container, 'Tags')
  await act(async () => {
    openCombobox(tags)
    await until(() => document.body.querySelector('[role="option"]') !== null)
    await view.api.settle()
  })
  act(() => click(option(document.body, 'Snapshot tag')))
  await syncThroughDocumentActions(view)

  const call = view.api.calls.find(request =>
    request.method === 'PUT' && request.path.endsWith('/revisions'))
  if (call === undefined) {
    throw new Error('The real draft client did not send a revision packet')
  }
  const save = saveSchema.parse(call.json)
  expect(save.document).toMatchObject({
    meta: {
      tags: [
        { id: tag.id, label: tag.name, slug: 'snapshot-tag' },
      ],
    },
  })
  expect(view.api.calls.map(request => `${request.method} ${request.path}`)).toContain(
    `PUT /api/admin/documents/${initial.documentId}/revisions`,
  )
})

it('a held schedule request disables publish until the real schedule controller settles', async () => {
  const initial = editorWorkspaceDocument('Scheduling lock')
  const started = defer()
  const release = defer()
  const timeRequested = defer()
  const runAt = Date.UTC(2099, 4, 1, 1, 30)
  const scheduleId = '9b2f0c4a-1d3e-4f5a-8b6c-7d8e9f0a1b2c'
  const pendingItem = scheduleItemSchema.parse({
    id: scheduleId,
    revisionId: initial.headRevisionId,
    state: 'pending',
    runAt,
    localTime: '2099-05-01T10:30',
    timezone: 'UTC',
    utcOffset: 0,
    attempts: 0,
    nextAttemptAt: runAt,
    errorCode: null,
    createdAt: runAt,
  })
  const view = await mountEditorChrome({
    initial,
    handlers: scheduleHandlers({
      initial,
      pendingItem,
      scheduleId,
      started,
      release,
      timeRequested,
    }),
  })

  act(() => click(button(view.container, 'Publication')))
  act(() => click(button(view.container, 'Scheduled publication')))
  await selectScheduleDate(view.container)
  typeText(field(view.container, 'Publication time'), '10:30')
  await chooseVerifiedScheduleTime(view.container, view, timeRequested)

  const schedule = button(view.container, 'Schedule saved draft')
  expect(schedule.disabled).toBe(false)
  await act(async () => {
    click(schedule)
    await started.promise
  })
  const publish = one<HTMLButtonElement>(view.container, '.editor-publish-action')
  expect(publish.disabled).toBe(true)

  release.open()
  await act(async () => {
    await view.api.expectServed()
  })
  expect(publish.disabled).toBe(false)
  expect(button(view.container, 'Cancel schedule').disabled).toBe(false)
  expect(view.api.unhandled).toEqual([])
})
