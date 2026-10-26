import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { openDocumentSchema } from '@/contracts/documents'
import { scheduleTimeSchema } from '@/contracts/publication'
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
  typeText,
} from './dom'
import { mountEditorChrome, resetEditorChrome } from './editor-chrome-support'
import { setMediaState, until } from './environment'

afterEach(resetEditorChrome)

async function chooseTimezone(root: ParentNode, timezone: string): Promise<void> {
  const control = combobox(root, 'Publication timezone')
  await act(async () => {
    click(control)
    await until(() => document.body
      .querySelector('[role="combobox"][aria-label="Search cities or timezones"]') !== null)
    typeText(one(document.body, '[role="combobox"][aria-label="Search cities or timezones"]'), timezone)
    await until(() => all(document.body, '[role="option"]').some(item =>
      item.textContent.includes(timezone)))
    click(option(document.body, timezone))
  })
}

async function choosePublicationDate(root: ParentNode): Promise<void> {
  const date = one<HTMLButtonElement>(root, 'button[aria-label="Publication date"]')
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
  expect(day).toBeDefined()
  if (day === undefined) {
    throw new Error('The selected month has no first day')
  }
  act(() => click(day))
  expect(date.textContent).toContain('May 1, 2099')
  await until(() => document.body.querySelector('.app-calendar') === null)
}

function expectScheduleValues(root: ParentNode): void {
  expect(one<HTMLButtonElement>(root, 'button[aria-label="Publication date"]').textContent)
    .toContain('May 1, 2099')
  expect(one<HTMLInputElement>(root, 'input[type="time"]').value).toBe('10:30')
  expect(combobox(root, 'Publication timezone').textContent).toContain('Asia/Tokyo')
  const verified = combobox(root, 'Verified UTC time').textContent
  expect(verified).toContain('2099-05-01T01:30:00.000Z')
  expect(verified).toContain('540')
}

it('the schedule form retains its values through the compact settings lifecycle', async () => {
  const runAt = Date.UTC(2099, 4, 1, 1, 30)
  const view = await mountEditorChrome({
    width: 320,
    handlers: {
      'GET /api/admin/schedule-time': () => ({
        body: scheduleTimeSchema.parse({
          choices: [
            { runAt, utcOffset: 540 },
          ],
        }),
      }),
    },
  })
  act(() => click(button(view.container, 'Document settings')))
  await act(async () => {
    await until(() => document.body.querySelector('[role="dialog"]') !== null)
  })
  const initialDrawer = one(document.body, '[role="dialog"]')
  act(() => click(button(initialDrawer, 'Publication')))
  act(() => click(button(initialDrawer, 'Scheduled publication')))
  await choosePublicationDate(initialDrawer)
  typeText(field(initialDrawer, 'Publication time'), '10:30')
  await chooseTimezone(initialDrawer, 'Asia/Tokyo')
  await act(async () => {
    click(button(initialDrawer, 'Check timezone and DST'))
    await view.api.expectServed()
  })
  const verified = combobox(initialDrawer, 'Verified UTC time')
  await act(async () => {
    openCombobox(verified)
    await until(() => document.body.querySelector('[role="option"]') !== null)
  })
  act(() => click(option(document.body, '2099-05-01T01:30:00.000Z')))
  expectScheduleValues(initialDrawer)

  act(() => click(button(initialDrawer, 'Close')))
  await act(async () => {
    await until(() => document.body.querySelector('[role="dialog"]') === null)
  })
  act(() => click(button(view.container, 'Document settings')))
  await act(async () => {
    await until(() => document.body.querySelector('[role="dialog"]') !== null)
  })
  expectScheduleValues(one(document.body, '[role="dialog"]'))

  setMediaState({ width: 1440 })
  await until(() => view.container.querySelector('aside[aria-label="Document settings"]') !== null)
  expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  expectScheduleValues(one(view.container, 'aside[aria-label="Document settings"]'))

  setMediaState({ width: 320 })
  await until(() => view.container.querySelector('aside[aria-label="Document settings"]') === null)
  expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  act(() => click(button(view.container, 'Document settings')))
  await act(async () => {
    await until(() => document.body.querySelector('[role="dialog"]') !== null)
  })
  expectScheduleValues(one(document.body, '[role="dialog"]'))
  await view.api.expectServed()
})

it('the schedule calendar applies its selected date and default time to the real form', async () => {
  const view = await mountEditorChrome({ width: 1440 })
  act(() => click(button(view.container, 'Publication')))
  act(() => click(button(view.container, 'Scheduled publication')))
  await choosePublicationDate(view.container)
  expect(one<HTMLInputElement>(view.container, 'input[type="time"]').value).toBe('09:00')
})

it('the real header describes a published revision with a dirty draft', async () => {
  const opened = editorWorkspaceDocument('Wrapped status')
  const initial = openDocumentSchema.parse({
    ...opened,
    liveRevisionId: opened.headRevisionId,
    livePath: `/posts/${opened.document.meta.slug}`,
  })
  const view = await mountEditorChrome({ initial, width: 1440 })

  typeText(field(view.container, 'Slug'), 'wrapped-status-changed')
  const saveStatus = one(view.container, '.workspace-status .save-status')
  expect(saveStatus.getAttribute('data-status')).toBe('dirty')
  const publication = view.container.querySelector('.workspace-status [data-state="changed"]')
  expect(publication).not.toBeNull()
  if (publication === null) {
    throw new Error('The published-with-changes badge is missing')
  }
  expect(publication.textContent.trim()).toBe('Published · unpublished changes')
})

it('the settings panel opens and cancels a reference editor without losing its content tab', async () => {
  const view = await mountEditorChrome({ width: 1440 })
  const settings = view.container.querySelector<HTMLElement>('aside[aria-label="Document settings"]')
  expect(settings).not.toBeNull()
  if (settings === null) {
    throw new Error('The desktop settings panel is missing')
  }
  act(() => click(button(settings, 'References (0)')))
  act(() => click(button(settings, 'Add reference')))
  await until(() => document.body.querySelector('[role="dialog"]') !== null)
  expect(one(document.body, '[role="dialog"]').textContent).toContain('Add reference')
  act(() => click(button(document.body, 'Cancel')))
  await until(() => document.body.querySelector('[role="dialog"]') === null)
  expect(one(settings, '[role="tab"][aria-selected="true"]').textContent.trim()).toBe('Content')
})
