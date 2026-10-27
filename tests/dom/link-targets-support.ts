import type { MountedLinkEditor } from './link-harness'
import { act } from 'react'
import { expect } from 'vitest'
import { z } from 'zod'
import { validateDocument } from '@/content/document'
import { inline } from '@/content/inline'
import { saveSchema } from '@/contracts/documents'
import {
  charactersOf,
  charactersWithLink,
  editedLinkContent,
  nextLink,
  oldLink,
  replacementLink,
  unlinkedEditedContent,
} from '~/tests/components/support/editor-link-remaining-fixtures'
import { all, button, click, field, one, typeText } from './dom'
import { until } from './environment'
import { editorBody } from './link-harness'
import { flushDraft, revisionWrites, selectLinkText } from './link-harness-interactions'

const dialogTitle = 'Edit link'

function buttonByName(root: ParentNode, name: string): HTMLButtonElement | null {
  const found = all<HTMLButtonElement>(root, 'button').filter((item) => {
    const ariaLabel = item.getAttribute('aria-label')
    const textContent = item.textContent
    const title = item.getAttribute('title')
    return ariaLabel === name
      || textContent.replaceAll(/\s+/g, ' ').trim() === name
      || (title !== null && title.split(' · ')[0] === name)
  })
  return found.length === 1 ? found[0] ?? null : null
}

export function dialogByName(name: string): HTMLElement | null {
  return all<HTMLElement>(document.body, '[role="dialog"]').find((dialog) => {
    const heading = dialog.querySelector('h2')
    const title = heading === null ? '' : heading.textContent
    return title.replaceAll(/\s+/g, ' ').trim() === name
  }) ?? null
}

export function insertAtTextStart(view: MountedLinkEditor, value: string): void {
  const block = view.editor.document[0]
  if (block === undefined) {
    throw new Error('The editor document has no paragraph')
  }
  view.editor.setTextCursorPosition(block.id, 'start')
  view.editor.insertInlineContent([
    {
      type: 'text',
      text: value,
      styles: {},
    },
  ])
}

export async function waitForDOM(condition: () => boolean, description = 'the expected DOM state'): Promise<void> {
  try {
    await act(async () => {
      await until(condition)
    })
  }
  catch {
    const dialogs = all<HTMLElement>(document.body, '[role="dialog"]')
      .map((dialog) => {
        const heading = dialog.querySelector('h2')
        const title = heading === null ? 'untitled' : heading.textContent
        return title.trim()
      })
      .join(', ')
    const toolbar = document.body.querySelector('.bn-link-toolbar') !== null
    const dialogSummary = dialogs.length === 0 ? 'none' : dialogs
    const toolbarSummary = toolbar ? 'open' : 'closed'
    throw new Error(
      `Timed out waiting for ${description}; dialogs=${dialogSummary}; link-toolbar=${toolbarSummary}`,
    )
  }
}

async function waitForLinkToolbar(view: MountedLinkEditor): Promise<void> {
  await waitForDOM(
    () => view.container.querySelector('.bn-link-toolbar') !== null,
    'the adjacent-link toolbar',
  )
}

export function inputField(root: ParentNode, name: string): HTMLInputElement {
  const input = field(root, name)
  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError(`The "${name}" control is not an input`)
  }
  return input
}

function dispatchShortcut(view: MountedLinkEditor): void {
  editorBody(view).dispatchEvent(new KeyboardEvent('keydown', {
    key: 'k',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  }))
}

export async function openCreateLink(view: MountedLinkEditor): Promise<HTMLElement> {
  act(() => dispatchShortcut(view))
  await waitForDOM(() => dialogByName('Create link') !== null)
  const dialog = dialogByName('Create link')
  if (dialog === null) {
    throw new Error('The production shortcut did not render its link dialog')
  }
  return dialog
}

function packetCharacters(view: MountedLinkEditor): ReturnType<typeof charactersOf> {
  const call = revisionWrites(view).at(-1)
  expect(call?.method).toBe('PUT')
  expect(call?.path).toBe(`/api/admin/documents/${view.initial.documentId}/revisions`)
  const packet = saveSchema.parse(call?.json)
  const document = validateDocument(packet.document)
  return charactersOf(z.array(inline).parse(document.blocks[0]?.content))
}

export function expectPacketCharacters(
  view: MountedLinkEditor,
  expected: ReturnType<typeof charactersOf>,
  version: number,
): void {
  const call = revisionWrites(view).at(-1)
  expect(call?.method).toBe('PUT')
  expect(call?.path).toBe(`/api/admin/documents/${view.initial.documentId}/revisions`)
  const packet = saveSchema.parse(call?.json)
  expect(packet.expectedVersion).toBe(version)
  expect(packet.reason).toBe('autosave')
  expect(packetCharacters(view)).toEqual(expected)
}

export function expectedLinkContent(
  original: ReturnType<typeof charactersOf>,
  selection: { readonly from: number, readonly to: number },
): ReturnType<typeof charactersOf> {
  return charactersWithLink(original, selection, replacementLink)
}

export async function editAdjacentLink(view: MountedLinkEditor): Promise<void> {
  await selectLinkText(view, { start: 6, end: 6 })
  const beta = all<HTMLAnchorElement>(editorBody(view), 'a')
    .find(anchor => anchor.textContent === 'Beta')
  if (beta === undefined) {
    throw new Error('The adjacent-link fixture has no Beta anchor')
  }
  expect(beta.getAttribute('href')).toBe(nextLink)
  await waitForLinkToolbar(view)
  const toolbar = one(document.body, '.bn-link-toolbar')
  const edit = buttonByName(toolbar, 'Edit link')
  if (edit === null) {
    throw new Error('The production link toolbar has no Edit link action')
  }
  act(() => click(edit))
  await waitForDOM(() => dialogByName(dialogTitle) !== null, 'the Edit link dialog')
  const dialog = dialogByName(dialogTitle)
  if (dialog === null) {
    throw new Error('The production Edit link dialog did not open')
  }
  const title = field(dialog, 'Edit title')
  const url = field(dialog, 'Edit URL')
  expect(inputField(dialog, 'Edit URL').value).toBe(nextLink)
  expect(inputField(dialog, 'Edit title').value).toBe('Beta')
  act(() => typeText(title, ''))
  act(() => click(button(dialog, 'Save')))
  await waitForDOM(
    () => title.getAttribute('aria-invalid') === 'true',
    'the empty link-title validation state',
  )
  expect(all(dialog, '[role="alert"]')[0]?.textContent)
    .toBe('Enter the text to display for this link.')
  expect(revisionWrites(view)).toEqual([])

  act(() => typeText(title, 'Updated'))
  act(() => typeText(url, '#anchor'))
  act(() => click(button(dialog, 'Save')))
  await waitForDOM(() => dialogByName(dialogTitle) === null)
  await flushDraft(view)
  expect(editorBody(view).textContent).toBe('AlphaUpdatedPlain')
  const links = all<HTMLAnchorElement>(editorBody(view), 'a')
    .map(anchor => [
      anchor.textContent,
      anchor.getAttribute('href'),
    ])
  expect(links).toEqual([
    ['Alpha', oldLink],
    ['Updated', '#anchor'],
  ])
  expectPacketCharacters(view, charactersOf(editedLinkContent()), 0)
}

export async function unlinkEditedLink(view: MountedLinkEditor): Promise<void> {
  await selectLinkText(view, { start: 6, end: 6 })
  await waitForLinkToolbar(view)
  const unlink = buttonByName(one(document.body, '.bn-link-toolbar'), 'Remove link')
  if (unlink === null) {
    throw new Error('The production link toolbar has no Remove link action')
  }
  act(() => click(unlink))
  await flushDraft(view)
  const links = all<HTMLAnchorElement>(editorBody(view), 'a')
    .map(anchor => [
      anchor.textContent,
      anchor.getAttribute('href'),
    ])
  expect(links).toEqual([
    ['Alpha', oldLink],
  ])
  expectPacketCharacters(view, charactersOf(unlinkedEditedContent()), 1)

  const undo = buttonByName(view.container, 'Undo')
  if (undo === null) {
    throw new Error('The production editor toolbar has no Undo control')
  }
  act(() => click(undo))
  await flushDraft(view)
  const restoredLinks = all<HTMLAnchorElement>(editorBody(view), 'a')
    .map(anchor => [
      anchor.textContent,
      anchor.getAttribute('href'),
    ])
  expect(restoredLinks).toEqual([
    ['Alpha', oldLink],
    ['Updated', '#anchor'],
  ])
  expectPacketCharacters(view, charactersOf(editedLinkContent()), 2)
}
