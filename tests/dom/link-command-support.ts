import type { MountedLinkEditor } from './link-harness'
import type { deferFocusScopeClose } from './link-harness-interactions'
import { act } from 'react'
import { expect } from 'vitest'
import { validateDocument } from '@/content/document'
import { saveSchema } from '@/contracts/documents'
import { all, click, field } from './dom'
import { until } from './environment'
import { editorBody } from './link-harness'
import {
  flushDraft,
  revisionWrites,
  selectLinkText,
} from './link-harness-interactions'

export { editorBody, flushDraft, revisionWrites, selectLinkText }

export const linkCopy = {
  en: {
    toolbar: 'Formatting',
    more: 'More formatting options',
    drawer: 'Formatting options',
    dialog: 'Create link',
    url: 'Edit URL',
    save: 'Save',
    cancel: 'Cancel',
    undo: 'Undo',
    invalid: 'Enter a valid',
  },
  zh: {
    toolbar: '文字格式',
    more: '更多格式选项',
    drawer: '格式选项',
    dialog: '添加链接',
    url: '编辑链接地址',
    save: '保存',
    cancel: '取消',
    undo: '撤销',
    invalid: '请输入有效',
  },
} as const

export const linkPrefix = 'Before '
export const linkSelected = 'Selected link'
export const linkSuffix = ' untouched suffix'
export const selectedRange = {
  start: linkPrefix.length,
  end: linkPrefix.length + linkSelected.length,
}
export const plainContent = [
  {
    type: 'text',
    text: `${linkPrefix}${linkSelected}${linkSuffix}`,
    styles: {},
  },
]
export const destinations = [
  {
    input: '/posts/entry#part',
    href: '/posts/entry#part',
  },
  {
    input: 'HTTPS://example.com/Case',
    href: 'https://example.com/Case',
  },
  {
    input: 'httpbin.org/get',
    href: 'https://httpbin.org/get',
  },
  {
    input: '#section',
    href: '#section',
  },
] as const
export const invalidDestinations = [
  '',
  'https://exa mple.com',
  'ftp://example.com',
  '//elsewhere.example/path',
  'https://user:password@example.com',
  `example.com/${'x'.repeat(2036)}`,
]

export function linkedContent(href: string): unknown[] {
  return [
    { type: 'text', text: linkPrefix, styles: {} },
    { type: 'link', href, content: [
      { type: 'text', text: linkSelected, styles: {} },
    ] },
    { type: 'text', text: linkSuffix, styles: {} },
  ]
}

export function buttonByName(root: ParentNode, name: string): HTMLButtonElement | null {
  const found = all<HTMLButtonElement>(root, 'button').filter((item) => {
    const label = item.getAttribute('aria-label')
    const text = item.textContent
    const title = item.getAttribute('title')
    return label === name
      || text.replaceAll(/\s+/g, ' ').trim() === name
      || (title !== null && title.split(' · ')[0] === name)
  })
  return found.length === 1 ? found[0] ?? null : null
}

export function dialogByName(name: string): HTMLElement | null {
  return all<HTMLElement>(document.body, '[role="dialog"]').find((dialog) => {
    const heading = dialog.querySelector('h2')
    return heading !== null && heading.textContent.replaceAll(/\s+/g, ' ').trim() === name
  }) ?? null
}

export function inputField(root: ParentNode, name: string): HTMLInputElement {
  const input = field(root, name)
  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError(`The "${name}" control is not an input`)
  }
  return input
}

export async function waitForDOM(
  condition: () => boolean,
  description = 'the expected DOM state',
): Promise<void> {
  try {
    await act(async () => {
      await until(condition)
    })
  }
  catch {
    const dialogs = all<HTMLElement>(document.body, '[role="dialog"]')
      .map((dialog) => {
        const heading = dialog.querySelector('h2')
        const title = heading === null ? 'untitled' : heading.textContent.trim()
        return `${dialog.getAttribute('data-state') ?? 'no-state'}:${title}`
      })
      .join(', ')
    const dialogSummary = dialogs.length === 0 ? 'none' : dialogs
    throw new Error(`Timed out waiting for ${description}; dialogs=${dialogSummary}`)
  }
}

export async function waitForFocusClose(
  probe: ReturnType<typeof deferFocusScopeClose>,
): Promise<void> {
  let deadline: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      probe.captured,
      new Promise<never>((_resolve, reject) => {
        deadline = setTimeout(() => {
          const targets = probe.observedTargets().join(', ')
          const summary = targets.length === 0 ? 'none' : targets
          reject(new Error(`No focus-scope close event was dispatched; targets=${summary}`))
        }, 2500)
      }),
    ])
  }
  finally {
    if (deadline !== undefined) {
      clearTimeout(deadline)
    }
  }
}

export function dispatchShortcut(view: MountedLinkEditor, modifier: 'Control' | 'Meta'): void {
  editorBody(view).dispatchEvent(new KeyboardEvent('keydown', {
    key: 'k',
    ctrlKey: modifier === 'Control',
    metaKey: modifier === 'Meta',
    bubbles: true,
    cancelable: true,
  }))
}

export async function openShortcutLink(
  view: MountedLinkEditor,
  locale: 'en' | 'zh',
  modifier: 'Control' | 'Meta',
): Promise<HTMLElement> {
  act(() => dispatchShortcut(view, modifier))
  try {
    await waitForDOM(() => dialogByName(linkCopy[locale].dialog) !== null)
  }
  catch {
    const selection = view.editor.prosemirrorState.selection
    const domSelection = document.getSelection()
    const dialogs = all<HTMLElement>(document.body, '[role="dialog"]')
      .map((dialog) => {
        const heading = dialog.querySelector('h2')
        return heading === null ? 'untitled' : heading.textContent.trim()
      })
      .join(', ')
    const domText = domSelection?.toString() ?? ''
    const collapsed = domSelection === null ? 'unknown' : String(domSelection.isCollapsed)
    const summary = dialogs.length === 0 ? 'none' : dialogs
    throw new Error(
      `No ${linkCopy[locale].dialog} dialog after ${modifier}+K; editor-range=${selection.from}-${selection.to}; `
      + `DOM-selection=${domText}; collapsed=${collapsed}; dialogs=${summary}`,
    )
  }
  const dialog = dialogByName(linkCopy[locale].dialog)
  if (dialog === null) {
    throw new Error('The production shortcut did not render its link dialog')
  }
  return dialog
}

export async function openToolbarLink(
  view: MountedLinkEditor,
  locale: 'en' | 'zh',
  width: number,
): Promise<HTMLElement> {
  const labels = linkCopy[locale]
  if (width <= 700) {
    const more = buttonByName(view.container, labels.more)
    if (more === null) {
      throw new Error('The production compact formatting toolbar has no More options button')
    }
    act(() => click(more))
    await waitForDOM(() => dialogByName(labels.drawer) !== null)
    const drawer = dialogByName(labels.drawer)
    if (drawer === null) {
      throw new Error('The production formatting drawer did not open')
    }
    const create = buttonByName(drawer, labels.dialog)
    if (create === null) {
      throw new Error('The production formatting drawer has no Create link action')
    }
    act(() => click(create))
    await waitForDOM(() => dialogByName(labels.drawer) === null && dialogByName(labels.dialog) !== null)
  }
  else {
    await waitForDOM(() => {
      const toolbar = all<HTMLElement>(view.container, '[role="toolbar"]')
        .find(item => item.getAttribute('aria-label') === labels.toolbar)
      return toolbar !== undefined && buttonByName(toolbar, labels.dialog) !== null
    })
    const toolbar = all<HTMLElement>(view.container, '[role="toolbar"]')
      .find(item => item.getAttribute('aria-label') === labels.toolbar)
    const create = toolbar === undefined ? null : buttonByName(toolbar, labels.dialog)
    if (create === null) {
      throw new Error('The production formatting toolbar has no Create link action')
    }
    act(() => click(create))
    await waitForDOM(() => dialogByName(labels.dialog) !== null)
  }
  const dialog = dialogByName(labels.dialog)
  if (dialog === null) {
    throw new Error('The production toolbar did not render its link dialog')
  }
  return dialog
}

export function revisionContent(view: MountedLinkEditor, expected: unknown, version: number): void {
  const call = revisionWrites(view).at(-1)
  expect(call?.method).toBe('PUT')
  expect(call?.path).toBe(`/api/admin/documents/${view.initial.documentId}/revisions`)
  const packet = saveSchema.parse(call?.json)
  expect(packet.expectedVersion).toBe(version)
  expect(packet.reason).toBe('autosave')
  expect(validateDocument(packet.document).blocks[0]?.content).toEqual(expected)
}
