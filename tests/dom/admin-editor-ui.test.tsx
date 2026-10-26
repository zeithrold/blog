import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { acknowledgementSchema } from '@/contracts/documents'
import { editorWorkspaceDocument } from '~/tests/components/support/editor-workspace-fixtures'
import {
  all,
  button,
  click,
  combobox,
  one,
  openCombobox,
  option,
  press,
} from './dom'
import { mountEditorChrome, resetEditorChrome } from './editor-chrome-support'
import { until } from './environment'

afterEach(resetEditorChrome)

it('publication actions name the real live state and keep draft sync disabled while saved', async () => {
  const initial = editorWorkspaceDocument('Publication action labels')
  const view = await mountEditorChrome({
    initial,
    handlers: {
      'POST /api/admin/documents/:id/publish': () => ({
        body: acknowledgementSchema.parse({
          documentId: initial.documentId,
          version: 1,
          headRevisionId: initial.headRevisionId,
          liveRevisionId: initial.headRevisionId,
          liveGeneration: 1,
        }),
      }),
    },
  })
  const publish = one<HTMLButtonElement>(view.container, '.editor-publish-action')
  expect(publish.getAttribute('aria-label')).toBe('Publish')
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
  expect(sync).toBeDefined()
  if (sync === undefined) {
    throw new Error('The sync menu item is missing')
  }
  expect(sync.getAttribute('aria-disabled')).toBe('true')
  await act(async () => {
    press(one(document.body, '[role="menu"]'), 'Escape')
    await until(() => document.body.querySelector('[role="menu"]') === null)
  })

  const language = combobox(view.container, 'Language')
  await act(async () => {
    openCombobox(language)
    await until(() => document.body.querySelector('[role="option"]') !== null)
  })
  act(() => click(option(document.body, '简体中文')))
  await until(() => view.container.querySelector('.editor-publish-action')?.getAttribute('aria-label') === '发布')
  await act(async () => {
    click(publish)
    await view.api.expectServed()
  })
  await until(() => publish.getAttribute('aria-label') === '更新发布')
  expect(view.api.calls.map(call => `${call.method} ${call.path}`)).toContain(
    `POST /api/admin/documents/${initial.documentId}/publish`,
  )
})

it('the preview dialog reads the real draft and closes from its settings entry', async () => {
  const view = await mountEditorChrome({ width: 1440 })
  await act(async () => {
    click(button(view.container, 'Preview'))
    await until(() => document.body.querySelector('.draft-preview-dialog') !== null)
  })
  const preview = one<HTMLElement>(document.body, '.draft-preview-dialog')
  expect(preview.textContent).toContain('Draft preview')
  expect(preview.querySelector('[role="region"][aria-label="Draft reader preview"]')).not.toBeNull()
  const close = preview.querySelector<HTMLButtonElement>('button[aria-label="Close preview"]')
  expect(close).not.toBeNull()
  if (close === null) {
    throw new Error('The preview close action is missing')
  }
  await act(async () => {
    click(close)
    await until(() => document.body.querySelector('.draft-preview-dialog') === null)
  })
  await view.api.expectServed()
  expect(view.api.calls.every(call => call.method === 'GET')).toBe(true)
})

it('the settings panel renders labeled catalog fields without a fieldset', async () => {
  const view = await mountEditorChrome({ width: 1440 })
  const settings = one(view.container, 'aside[aria-label="Document settings"]')
  await act(async () => {
    click(button(settings, 'Tags and series'))
    await view.api.settle()
  })

  expect(settings.querySelector('fieldset')).toBeNull()
  expect(all(settings, '.catalog-field')).toHaveLength(2)
  for (const name of ['Tags', 'Series']) {
    const control = combobox(settings, name)
    const id = control.getAttribute('id')
    expect(id).not.toBeNull()
    expect(all<HTMLLabelElement>(settings, 'label').some(label => label.htmlFor === id)).toBe(true)
  }
  const manageTags = settings.querySelector<HTMLAnchorElement>('a[href="/admin/tags"]')
  expect(manageTags?.textContent).toContain('Manage tags')
})
