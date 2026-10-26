import { act } from 'react'
import { expect, it } from 'vitest'
import { button, click, one } from './dom'
import { until } from './environment'
import { defer } from './http'
import {
  editorElement,
  flushSourceDraft,
  mountSourceEditor,
  revisionWrites,
  savedDocument,
  sourceDocument,
  sourceEditButton,
  sourceField,
  sourceText,
} from './source-support'

function dispatchKey(view: Awaited<ReturnType<typeof mountSourceEditor>>, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  act(() => {
    editorElement(view).dispatchEvent(event)
  })
  return event
}

function dispatchBeforeInput(
  view: Awaited<ReturnType<typeof mountSourceEditor>>,
  inputType: string,
  data: string | null = null,
): InputEvent {
  const event = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType,
    data,
  })
  act(() => {
    editorElement(view).dispatchEvent(event)
  })
  return event
}

function dispatchPaste(
  view: Awaited<ReturnType<typeof mountSourceEditor>>,
  text: string,
): Event {
  // jsdom has neither DataTransfer nor ClipboardEvent; only the declared text/html payload is shimmed.
  const clipboardData = {
    files: [],
    getData: (format: string) => format === 'text/plain'
      ? text
      : '<p>HTML must not create a block</p><p>Another block</p>',
  }
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: clipboardData })
  act(() => {
    editorElement(view).dispatchEvent(event)
  })
  return event
}

function sourceTextInDocument(
  document: ReturnType<typeof savedDocument>,
  kind: 'math' | 'mermaid',
): string {
  const block = document.blocks.find(item => item.type === kind)
  return Array.isArray(block?.content)
    ? block.content.map(item => 'text' in item ? item.text : '').join('')
    : ''
}

for (const kind of ['math', 'mermaid'] as const) {
  it(`${kind} beforeinput prevents boundary deletion and inserts a source line`, async () => {
    const view = await mountSourceEditor(sourceDocument(kind))
    try {
      act(() => click(sourceEditButton(view, kind)))
      const deletion = dispatchBeforeInput(view, 'deleteContentForward')
      expect(deletion.defaultPrevented).toBe(true)
      expect(sourceField(view, kind).textContent).toBe(sourceText[kind])

      const lineBreak = dispatchBeforeInput(view, 'insertParagraph')
      expect(lineBreak.defaultPrevented).toBe(true)
      expect(sourceField(view, kind).textContent).toBe(`${sourceText[kind]}\n`)
      expect(view.editor.document.some(block => block.type === 'paragraph')).toBe(true)

      await flushSourceDraft(view)
      expect(sourceTextInDocument(savedDocument(view), kind)).toBe(`${sourceText[kind]}\n`)
    }
    finally {
      view.unmount()
    }
  })

  it(`${kind} rich clipboard on the Edit control inserts plain source without a new block`, async () => {
    const view = await mountSourceEditor(sourceDocument(kind))
    try {
      act(() => click(sourceEditButton(view, kind)))
      const inserted = kind === 'math' ? '\ny=2\nz=3' : '\nB-->C\nC-->D'
      const paste = dispatchPaste(view, inserted)
      expect(paste.defaultPrevented).toBe(true)
      expect(sourceField(view, kind).textContent).toBe(sourceText[kind] + inserted)
      expect(view.editor.document.filter(block => block.type === 'paragraph')).toHaveLength(1)

      await flushSourceDraft(view)
      expect(sourceTextInDocument(savedDocument(view), kind)).toBe(sourceText[kind] + inserted)
    }
    finally {
      view.unmount()
    }
  })

  it(`${kind} Delete at source end leaves the following paragraph and sends no write`, async () => {
    const view = await mountSourceEditor(sourceDocument(kind))
    try {
      act(() => click(sourceEditButton(view, kind)))
      const deletion = dispatchKey(view, 'Delete')
      expect(deletion.defaultPrevented).toBe(true)
      expect(sourceField(view, kind).textContent).toBe(sourceText[kind])
      expect(view.editor.document.at(-1)?.content).toEqual([
        { type: 'text', text: 'Keep this paragraph', styles: {} },
      ])
      expect(revisionWrites(view)).toHaveLength(0)
    }
    finally {
      view.unmount()
    }
  })
}

it('Done closes a lone source and keeps its source text in the saved document', async () => {
  const view = await mountSourceEditor(sourceDocument('math', 'lone'))
  try {
    act(() => click(sourceEditButton(view, 'math')))
    act(() => click(button(view.container, 'Done')))
    expect(one(view.container, '[data-content-type="math"] .bn-preview-with-source-popup')
      .getAttribute('data-open')).toBe('false')
    expect(one(view.container, '[data-content-type="math"] .bn-source-block-popup')
      .getAttribute('aria-hidden')).toBe('true')
    expect(sourceField(view, 'math').textContent).toBe(sourceText.math)
    expect(view.editor.document.at(-1)?.type).toBe('paragraph')

    await flushSourceDraft(view)
    expect(sourceTextInDocument(savedDocument(view), 'math')).toBe(sourceText.math)
  }
  finally {
    view.unmount()
  }
})

it('a held Publish request makes the source editor read-only until its acknowledgement', async () => {
  const initial = sourceDocument('math', 'lone')
  const held = defer()
  const view = await mountSourceEditor(initial, {
    handlers: {
      'POST /api/admin/documents/:id/publish': async () => {
        await held.promise
        return {
          body: {
            documentId: initial.documentId,
            version: initial.version,
            headRevisionId: initial.headRevisionId,
            liveRevisionId: initial.headRevisionId,
            liveGeneration: 1,
          },
        }
      },
    },
  })
  try {
    act(() => click(sourceEditButton(view, 'math')))
    const publish = view.container.querySelector<HTMLButtonElement>('button.editor-publish-action')
    if (publish === null) {
      throw new Error('The editor header has no Publish control')
    }
    act(() => click(publish))
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await until(() => editorElement(view).getAttribute('contenteditable') === 'false')
    expect(sourceEditButton(view, 'math').disabled).toBe(true)

    act(() => click(button(view.container, 'Done')))
    expect(one(view.container, '[data-content-type="math"] .bn-preview-with-source-popup')
      .getAttribute('data-open')).toBe('false')
    expect(sourceField(view, 'math').textContent).toBe(sourceText.math)
    expect(revisionWrites(view)).toHaveLength(0)

    await act(async () => {
      held.open()
      await view.api.expectServed()
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
    })
    await until(() => editorElement(view).getAttribute('contenteditable') === 'true')
    expect(view.api.calls.map(call => `${call.method} ${call.path}`)).toContain(
      `POST /api/admin/documents/${initial.documentId}/publish`,
    )
  }
  finally {
    held.open()
    view.unmount()
  }
})
