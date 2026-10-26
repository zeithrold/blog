import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { editorWorkspaceDocument } from '~/tests/components/support/editor-workspace-fixtures'
import {
  all,
  button,
  click,
  field,
  one,
  press,
  typeText,
} from './dom'
import { mountEditorChrome, resetEditorChrome } from './editor-chrome-support'
import { setMediaState, until } from './environment'
import { failure } from './http'

afterEach(resetEditorChrome)

function trigger(view: Awaited<ReturnType<typeof mountEditorChrome>>, locale: 'en' | 'zh-CN'): HTMLButtonElement {
  const label = locale === 'en' ? 'More document actions' : '更多文档操作'
  const found = view.container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (found === null) {
    throw new Error('The document actions trigger is missing')
  }
  return found
}

async function openActions(view: Awaited<ReturnType<typeof mountEditorChrome>>, locale: 'en' | 'zh-CN'): Promise<void> {
  await act(async () => {
    press(trigger(view, locale), 'Enter')
    await until(() => document.body.querySelector('[role="menu"]') !== null)
  })
}

async function openMobileActions(
  view: Awaited<ReturnType<typeof mountEditorChrome>>,
  locale: 'en' | 'zh-CN',
): Promise<HTMLElement> {
  await act(async () => {
    click(trigger(view, locale))
    await until(() => document.body.querySelector('[role="dialog"]') !== null)
  })
  return one(document.body, '[role="dialog"]')
}

function menuItem(label: string): HTMLElement {
  const found = all(document.body, '[role="menuitem"]')
    .find(item => item.textContent.replace(/\s+/g, ' ').trim() === label)
  if (found === undefined) {
    throw new Error(`The document action "${label}" is missing`)
  }
  return found
}

for (const locale of ['en', 'zh-CN'] as const) {
  it(`the compact header and saved action menu expose independent ${locale} copy`, async () => {
    const view = await mountEditorChrome({ width: 1440, locale })
    const expected = locale === 'en'
      ? {
          back: 'All documents',
          compactBack: 'Back',
          publish: 'Publish',
          save: 'Save',
          sync: 'Sync draft now',
          preview: 'Preview',
          remove: 'Delete document',
        }
      : {
          back: '所有文档',
          compactBack: '返回',
          publish: '发布',
          save: '保存',
          sync: '立即同步草稿',
          preview: '预览',
          remove: '删除文档',
        }
    const back = one<HTMLAnchorElement>(view.container, '.workspace-header .back-link')
    expect(back.getAttribute('aria-label')).toBe(expected.back)
    expect(back.querySelector('.editor-back-full')?.textContent.trim()).toBe(expected.back)
    expect(back.querySelector('.editor-back-compact')?.textContent.trim()).toBe(expected.compactBack)
    expect(view.container.querySelector('.editor-publish-action')?.getAttribute('aria-label'))
      .toBe(expected.publish)
    expect(view.container.querySelector(`button[aria-label="${expected.save}"]`)).toBeNull()

    await openActions(view, locale)
    const sync = menuItem(expected.sync)
    expect(sync.getAttribute('aria-disabled')).toBe('true')
    expect(menuItem(expected.preview)).toBeDefined()
    expect(menuItem(expected.remove)).toBeDefined()
    await act(async () => {
      press(one(document.body, '[role="menu"]'), 'Escape')
      await until(() => document.body.querySelector('[role="menu"]') === null)
    })
    await view.api.expectServed()
  })
}

it('the mobile action drawer stays dismissed after widening until manually reopened', async () => {
  const view = await mountEditorChrome({ width: 390 })
  const drawer = await openMobileActions(view, 'en')
  expect(drawer.textContent).toContain('Preview')

  setMediaState({ width: 1440 })
  expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  expect(document.body.querySelector('[role="menu"]')).toBeNull()
  expect(trigger(view, 'en').isConnected).toBe(true)

  setMediaState({ width: 390 })
  expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  expect(document.body.querySelector('[role="menu"]')).toBeNull()
  const reopened = await openMobileActions(view, 'en')
  act(() => click(button(reopened, 'Close')))
  await act(async () => {
    await until(() => document.body.querySelector('[role="dialog"]') === null)
  })
  expect(trigger(view, 'en').isConnected).toBe(true)
  expect(view.api.calls.filter(call => call.method !== 'GET')).toEqual([])
  await view.api.expectServed()
})

it('a refused revision save makes the real draft and sync action conflict-disabled', async () => {
  const initial = editorWorkspaceDocument('Conflicting mobile draft')
  const view = await mountEditorChrome({
    initial,
    width: 390,
    showNotices: true,
    handlers: {
      'PUT /api/admin/documents/:id/revisions': () => failure(409, 'EDIT_CONFLICT'),
    },
  })
  act(() => click(button(view.container, 'Document settings')))
  await act(async () => {
    await until(() => document.body.querySelector('[role="dialog"]') !== null)
  })
  const settings = one(document.body, '[role="dialog"]')
  typeText(field(settings, 'Slug'), 'local-conflicting-draft')
  act(() => click(button(settings, 'Close')))
  await act(async () => {
    await until(() => document.body.querySelector('[role="dialog"]') === null)
  })
  const drawer = await openMobileActions(view, 'en')
  const sync = button(drawer, 'Sync draft now')
  expect(sync.disabled).toBe(false)

  await act(async () => {
    click(sync)
    await view.api.expectServed()
  })
  expect(view.state().workspace.draft.status).toBe('conflict')
  expect(one<HTMLButtonElement>(view.container, '.editor-publish-action').disabled).toBe(true)
  const conflictDrawer = await openMobileActions(view, 'en')
  expect(button(conflictDrawer, 'Sync draft now').disabled).toBe(true)
  expect(view.container.querySelector('.workspace-status .save-status')?.textContent.trim())
    .toBe('Conflict — draft preserved')
  const writes = view.api.calls.filter(call => call.method !== 'GET')
  expect(writes.map(call => `${call.method} ${call.path}`)).toEqual([
    `PUT /api/admin/documents/${initial.documentId}/revisions`,
  ])
})
