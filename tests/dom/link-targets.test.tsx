import { act } from 'react'
import { expect, it } from 'vitest'
import {
  adjacentLinkContent,
  adjacentLinks,
  charactersOf,
  urlShapedDocument,
} from '~/tests/components/support/editor-link-remaining-fixtures'
import { editorWorkspaceDocument, paragraphBlock } from '~/tests/components/support/editor-workspace-fixtures'
import { all, button, click, field, typeText } from './dom'
import { editorBody, mountLinkEditor } from './link-harness'
import { flushDraft, revisionWrites, selectLinkText } from './link-harness-interactions'
import {
  dialogByName,
  editAdjacentLink,
  expectedLinkContent,
  expectPacketCharacters,
  inputField,
  insertAtTextStart,
  openCreateLink,
  unlinkEditedLink,
  waitForDOM,
} from './link-targets-support'

const replacementLink = '/posts/replacement#part'
const desktopSelections = [
  { from: 1, to: 3 },
  { from: 9, to: 14 },
  { from: 5, to: 6 },
  { from: 3, to: 7 },
] as const

it('linking partial, following and crossing selections preserves the other characters and styles', async () => {
  const view = await mountLinkEditor({ document: adjacentLinks(), width: 1440 })
  try {
    const original = charactersOf(adjacentLinkContent())
    let expectedVersion = 0
    for (const selection of desktopSelections) {
      await selectLinkText(view, { start: selection.from, end: selection.to })
      const dialog = await openCreateLink(view)
      act(() => typeText(field(dialog, 'Edit URL'), replacementLink))
      act(() => click(button(dialog, 'Save')))
      await waitForDOM(() => dialogByName('Create link') === null)
      await flushDraft(view)
      expectPacketCharacters(view, expectedLinkContent(original, selection), expectedVersion++)

      const undo = all<HTMLButtonElement>(view.container, 'button')
        .find(item => item.getAttribute('aria-label') === 'Undo')
      if (undo === undefined) {
        throw new Error('The production editor toolbar has no Undo control')
      }
      act(() => click(undo))
      await flushDraft(view)
      expectPacketCharacters(view, original, expectedVersion++)
    }
  }
  finally {
    view.unmount()
  }
})

it('linking the compact partial-link selection preserves its neighbouring content', async () => {
  const view = await mountLinkEditor({ document: adjacentLinks(), width: 320 })
  try {
    const original = charactersOf(adjacentLinkContent())
    await selectLinkText(view, { start: 1, end: 3 })
    const dialog = await openCreateLink(view)
    act(() => typeText(field(dialog, 'Edit URL'), replacementLink))
    act(() => click(button(dialog, 'Save')))
    await waitForDOM(() => dialogByName('Create link') === null)
    await flushDraft(view)
    expectPacketCharacters(view, expectedLinkContent(original, { from: 1, to: 3 }), 0)
  }
  finally {
    view.unmount()
  }
})

for (const width of [1440, 320]) {
  it(`existing link edits and unlink target only the chosen adjacent link at ${width}px`, async () => {
    const view = await mountLinkEditor({ document: adjacentLinks(), width })
    try {
      await editAdjacentLink(view)
      await unlinkEditedLink(view)
      await view.api.expectServed()
    }
    finally {
      view.unmount()
    }
  })
}

it('a background document change keeps the typed URL and disables its captured target', async () => {
  const document = editorWorkspaceDocument('Background link change', (record) => {
    record.blocks = [
      paragraphBlock('AlphaBetaPlain'),
    ]
  })
  const view = await mountLinkEditor({ document })
  try {
    await selectLinkText(view, { start: 0, end: 5 })
    const dialog = await openCreateLink(view)
    const url = field(dialog, 'Edit URL')
    act(() => typeText(url, 'https://example.com/keep-this-input'))

    act(() => insertAtTextStart(view, 'Background '))
    await waitForDOM(() => {
      const alert = all<HTMLElement>(dialog, '[role="alert"]')[0]
      return alert !== undefined && alert.textContent.includes('The document changed.')
    })
    expect(inputField(dialog, 'Edit URL').value).toBe('https://example.com/keep-this-input')
    expect(button(dialog, 'Save').disabled).toBe(true)
    act(() => {
      url.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    })
    expect(dialogByName('Create link')).toBe(dialog)
    expect(all<HTMLAnchorElement>(editorBody(view), 'a')).toHaveLength(0)

    act(() => click(button(dialog, 'Cancel')))
    await waitForDOM(() => dialogByName('Create link') === null)
    expect(editorBody(view).textContent).toBe('Background AlphaBetaPlain')
    await flushDraft(view)
    expectPacketCharacters(view, charactersOf([
      {
        type: 'text',
        text: 'Background AlphaBetaPlain',
        styles: {},
      },
    ]), 0)
  }
  finally {
    view.unmount()
  }
})

it('stored URL-shaped text remains unlinked after the real editor loads and saves it', async () => {
  const view = await mountLinkEditor({ document: urlShapedDocument() })
  try {
    expect(editorBody(view).textContent).toBe('https://example.com ')
    expect(all<HTMLAnchorElement>(editorBody(view), 'a')).toHaveLength(0)
    expect(revisionWrites(view)).toEqual([])

    act(() => insertAtTextStart(view, 'Plain '))
    expect(editorBody(view).textContent).toBe('Plain https://example.com ')
    expect(all<HTMLAnchorElement>(editorBody(view), 'a')).toHaveLength(0)
    await flushDraft(view)
    expectPacketCharacters(view, charactersOf([
      {
        type: 'text',
        text: 'Plain https://example.com ',
        styles: {},
      },
    ]), 0)
  }
  finally {
    view.unmount()
  }
})
