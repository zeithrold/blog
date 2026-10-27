import { act } from 'react'
import { expect, it } from 'vitest'
import { all, button, click, field, typeText } from './dom'
import { drainHostTask, until } from './environment'
import { defer, failure } from './http'
import {
  buttonByName,
  dialogByName,
  inputField,
  linkCopy,
  linkedContent,
  linkPrefix,
  linkSelected,
  linkSuffix,
  openShortcutLink,
  openToolbarLink,
  revisionContent,
  revisionWrites,
  selectedRange,
  waitForDOM,
  waitForFocusClose,
} from './link-command-support'
import { editorBody, mountLinkEditor } from './link-harness'
import {
  deferFocusScopeClose,
  flushDraft,
  selectLinkText,
} from './link-harness-interactions'

type LinkView = Awaited<ReturnType<typeof mountLinkEditor>>

/** The fixture's real selection, checked against the editor state before the held Publish. */
async function expectSelectedLinkFixture(view: LinkView): Promise<void> {
  await selectLinkText(view, selectedRange)
  expect(view.editor.prosemirrorState.selection.empty).toBe(false)
  expect(view.editor.prosemirrorState.selection.to - view.editor.prosemirrorState.selection.from)
    .toBe(linkSelected.length)
  expect(window.getSelection()?.toString()).toBe(linkSelected)
  expect(editorBody(view).textContent).toBe(`${linkPrefix}${linkSelected}${linkSuffix}`)
  expect(revisionWrites(view)).toEqual([])
}

/** The positive control: once the held state is over, a valid selection opens the dialog again. */
async function expectReopenedLinkDialog(view: LinkView): Promise<void> {
  await selectLinkText(view, selectedRange)
  const reopened = await openShortcutLink(view, 'en', 'Control')
  expect(dialogByName(linkCopy.en.dialog)).toBe(reopened)
  expect(revisionWrites(view)).toEqual([])
  act(() => click(button(reopened, linkCopy.en.cancel)))
  await waitForDOM(() => dialogByName(linkCopy.en.dialog) === null)
}

it('a held Publish request makes the real editor read-only and suppresses link shortcuts', async () => {
  const held = defer()
  const started = defer()
  const view = await mountLinkEditor({
    width: 390,
    handlers: {
      'POST /api/admin/documents/:id/publish': async () => {
        started.open()
        await held.promise
        return failure(503, 'QA_REQUEST_NOT_EXECUTED')
      },
    },
  })
  try {
    await expectSelectedLinkFixture(view)

    const publish = buttonByName(view.container, 'Publish')
    if (publish === null) {
      throw new Error('The production editor has no Publish control')
    }
    await act(async () => {
      click(publish)
      await started.promise
    })
    expect(view.api.calls.some(call => call.method === 'POST')).toBe(true)
    await waitForDOM(() => editorBody(view).getAttribute('contenteditable') === 'false')
    for (const modifier of ['Control', 'Meta'] as const) {
      act(() => {
        editorBody(view).dispatchEvent(new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: modifier === 'Control',
          metaKey: modifier === 'Meta',
          bubbles: true,
          cancelable: true,
        }))
      })
      expect(dialogByName(linkCopy.en.dialog)).toBeNull()
    }
    expect(revisionWrites(view)).toEqual([])
    held.open()
    await act(async () => {
      await view.api.expectServed()
    })
    await waitForDOM(() => editorBody(view).getAttribute('contenteditable') === 'true')
    expect(editorBody(view).textContent).toBe(`${linkPrefix}${linkSelected}${linkSuffix}`)
    expect(all<HTMLAnchorElement>(editorBody(view), 'a')).toHaveLength(0)
    expect(revisionWrites(view)).toEqual([])

    await expectReopenedLinkDialog(view)
  }
  finally {
    await act(async () => {
      held.open()
      await view.api.expectServed()
    })
    await waitForDOM(() => editorBody(view).getAttribute('contenteditable') === 'true')
    view.unmount()
  }
})

it('the delayed dialog close cannot replace the reopened editor state', async () => {
  const view = await mountLinkEditor()
  const probe = deferFocusScopeClose('.editor-link-command')
  try {
    await selectLinkText(view, selectedRange)
    const first = await openShortcutLink(view, 'en', 'Meta')
    act(() => click(button(first, linkCopy.en.cancel)))
    await waitForFocusClose(probe)

    await selectLinkText(view, selectedRange)
    const reopened = await openShortcutLink(view, 'en', 'Meta')
    const url = inputField(reopened, linkCopy.en.url)
    act(() => typeText(url, '/posts/kept-input'))
    await act(async () => {
      probe.release()
      await until(() => dialogByName(linkCopy.en.dialog) !== null)
    })
    expect(dialogByName(linkCopy.en.dialog)).not.toBeNull()
    expect(url.value).toBe('/posts/kept-input')
    await act(async () => {
      click(button(reopened, linkCopy.en.cancel))
      await until(() => dialogByName(linkCopy.en.dialog) === null)
    })
    expect(revisionWrites(view)).toEqual([])
  }
  finally {
    act(() => probe.release())
    view.unmount()
    // Flush the released focus work here so it cannot surface inside the next case.
    await drainHostTask()
  }
})

it('the delayed compact drawer close waits before handing its range to one link editor', async () => {
  const view = await mountLinkEditor({ width: 390 })
  const probe = deferFocusScopeClose('.formatting-options-drawer')
  try {
    await selectLinkText(view, selectedRange)
    const more = buttonByName(view.container, linkCopy.en.more)
    if (more === null) {
      throw new Error('The compact formatting toolbar has no More options button')
    }
    act(() => click(more))
    await waitForDOM(() => dialogByName(linkCopy.en.drawer) !== null)
    const drawer = dialogByName(linkCopy.en.drawer)
    if (drawer === null) {
      throw new Error('The compact formatting drawer did not open')
    }
    const create = buttonByName(drawer, linkCopy.en.dialog)
    if (create === null) {
      throw new Error('The compact formatting drawer has no Create link action')
    }
    act(() => click(create))
    await waitForFocusClose(probe)
    expect(dialogByName(linkCopy.en.dialog)).toBeNull()

    await act(async () => {
      probe.release()
      await until(() => dialogByName(linkCopy.en.dialog) !== null)
    })
    const dialog = dialogByName(linkCopy.en.dialog)
    if (dialog === null) {
      throw new Error('The compact drawer did not release its link action')
    }
    act(() => typeText(field(dialog, linkCopy.en.url), '/posts/drawer-kept'))
    await drainHostTask()
    await act(async () => {
      click(button(dialog, linkCopy.en.save))
      await until(() => dialogByName(linkCopy.en.dialog) === null)
    })
    await flushDraft(view)
    revisionContent(view, linkedContent('/posts/drawer-kept'), 0)
  }
  finally {
    act(() => probe.release())
    view.unmount()
    await drainHostTask()
  }
})

it('the compact dark Chinese drawer opens and saves a localized link dialog', async () => {
  const view = await mountLinkEditor({ width: 390, locale: 'zh', mode: 'dark' })
  try {
    await selectLinkText(view, selectedRange)
    const dialog = await openToolbarLink(view, 'zh', 390)
    expect(dialog.getAttribute('data-color-scheme')).toBe('dark')
    expect(field(dialog, linkCopy.zh.url)).toBeInstanceOf(HTMLInputElement)
    act(() => typeText(field(dialog, linkCopy.zh.url), '/posts/internal-target#part'))
    act(() => click(button(dialog, linkCopy.zh.save)))
    await waitForDOM(() => dialogByName(linkCopy.zh.dialog) === null)
    await flushDraft(view)
    revisionContent(view, linkedContent('/posts/internal-target#part'), 0)
  }
  finally {
    view.unmount()
  }
})
