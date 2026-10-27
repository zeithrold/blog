import { BlockNoteEditor } from '@blocknote/core'
import { TextSelection } from 'prosemirror-state'
import { afterEach, expect, it, vi } from 'vitest'
import { emptyDocument } from '@/content/document'
import { paste } from '@/features/editor/engine/clipboard'
import { nativeBlocks } from '@/features/editor/engine/native'
import { editorSchema } from '@/features/editor/engine/schema'

const editors: (typeof editorSchema.BlockNoteEditor)[] = []

afterEach(() => {
  for (const editor of editors.splice(0)) {
    editor.unmount()
  }
  document.body.replaceChildren()
})

function setup() {
  vi.stubGlobal('ClipboardEvent', Event)
  const fields = emptyDocument()
  const editor = BlockNoteEditor.create({ schema: editorSchema, initialContent: nativeBlocks(fields) })
  const container = document.createElement('div')
  document.body.append(container)
  editor.mount(container)
  editors.push(editor)
  const rejected: string[] = []
  const receive = (formats: Record<string, string>, plainText = false) => {
    // jsdom has no DataTransfer; only the external clipboard boundary is supplied.
    const event = new Event('paste')
    Object.defineProperty(event, 'clipboardData', {
      value: { files: [], getData: (type: string) => formats[type] ?? '' },
    })
    return paste({
      // eslint-disable-next-line ts/no-unsafe-type-assertion -- ClipboardEvent is absent in jsdom.
      event: event as ClipboardEvent,
      editor,
      fields,
      plainText,
      update: patch => Object.assign(fields, patch),
      reject: (message) => { rejected.push(message) },
    })
  }
  return { editor, receive, rejected }
}

it('parses Chinese and English inline Markdown and supports undo', () => {
  const { editor, receive, rejected } = setup()
  receive({ 'text/plain': '**粗体 bold** 和 *斜体 italic* 与 `code`' })

  expect(editor.document[0]?.content).toEqual([
    { type: 'text', text: '粗体 bold', styles: { bold: true } },
    { type: 'text', text: ' 和 ', styles: {} },
    { type: 'text', text: '斜体 italic', styles: { italic: true } },
    { type: 'text', text: ' 与 ', styles: {} },
    { type: 'text', text: 'code', styles: { code: true } },
  ])
  expect(rejected).toEqual([])
  editor.undo()
  expect(editor.document[0]?.content).toEqual([])
})

it('parses single-line quotes, headings and lists into native blocks', () => {
  const { editor, receive, rejected } = setup()
  receive({ 'text/plain': '> 引用\n\n## Heading\n\n- One\n- Two' })

  expect(editor.document.slice(0, 4).map(block => block.type)).toEqual([
    'quote',
    'heading',
    'bulletListItem',
    'bulletListItem',
  ])
  expect(rejected).toEqual([])
})

it('uses native paste to replace a selected range instead of appending after it', () => {
  const { editor, receive, rejected } = setup()
  const id = editor.document[0]?.id ?? ''
  editor.updateBlock(id, { content: 'Before selected after' })
  editor.setTextCursorPosition(id, 'start')
  const start = editor.prosemirrorState.selection.from
  editor.transact((tr) => {
    tr.setSelection(TextSelection.create(tr.doc, start + 7, start + 15))
  })
  receive({ 'text/plain': '**replacement**\n\nSecond paragraph' })

  expect(JSON.stringify(editor.document)).not.toContain('selected')
  expect(JSON.stringify(editor.document)).toContain('replacement')
  expect(JSON.stringify(editor.document)).toContain('Second paragraph')
  expect(rejected).toEqual([])
})

it('prefers native HTML, then explicit Markdown, then ordinary HTML', () => {
  const { editor, receive } = setup()
  receive({
    'blocknote/html': '<p><strong>Native</strong></p>',
    'text/markdown': '*Markdown*',
    'text/html': '<p>HTML</p>',
  })
  expect(editor.document[0]?.content).toEqual([
    { type: 'text', text: 'Native', styles: { bold: true } },
  ])
})

it('supports explicit Markdown MIME without text/plain', () => {
  const { editor, receive } = setup()
  receive({ 'text/markdown': '**Markdown**', 'text/html': '<p>HTML</p>' })
  expect(editor.document[0]?.content).toEqual([
    { type: 'text', text: 'Markdown', styles: { bold: true } },
  ])
})

it('preserves sanitized HTML formatting instead of reinterpreting its plain text', () => {
  const { editor, receive } = setup()
  receive({ 'text/plain': '**literal**', 'text/html': '<p><em>HTML</em><script>alert(1)</script></p>' })
  expect(editor.document[0]?.content).toEqual([
    { type: 'text', text: 'HTML', styles: { italic: true } },
  ])
})

it('keeps a forced plain-text paste literal even when rich formats are present', () => {
  const { editor, receive } = setup()
  receive({ 'text/plain': '**literal**', 'text/html': '<p><strong>literal</strong></p>' }, true)
  expect(editor.document[0]?.content).toEqual([
    { type: 'text', text: '**literal**', styles: {} },
  ])
})

it('keeps code block contents literal', () => {
  const { editor, receive } = setup()
  const id = editor.document[0]?.id ?? ''
  editor.updateBlock(id, { type: 'codeBlock', props: { language: 'text' } })
  editor.setTextCursorPosition(id)
  receive({ 'text/plain': '**literal**\n> not a quote' })
  expect(editor.document[0]?.type).toBe('codeBlock')
  expect(editor.document[0]?.content).toEqual([
    { type: 'text', text: '**literal**\n> not a quote', styles: {} },
  ])
})

it('rejects oversized Markdown before mutating the document', () => {
  const { editor, receive, rejected } = setup()
  const before = editor.document
  receive({ 'text/markdown': '*'.repeat(32769) })
  expect(editor.document).toEqual(before)
  expect(rejected).toEqual(['Clipboard exceeds the supported size. Paste a smaller section.'])
})

it('discards unsafe link destinations instead of inserting executable links', () => {
  const { editor, receive, rejected } = setup()
  receive({ 'text/plain': '[unsafe](javascript:alert%281%29)' })
  expect(editor.document[0]?.content).toEqual([
    { type: 'text', text: 'unsafe', styles: {} },
  ])
  expect(rejected).toEqual([])
})

it('retains unsupported media Markdown for plain-text recovery without mutating the document', () => {
  const { editor, receive, rejected } = setup()
  const before = editor.document
  receive({ 'text/plain': '![external](https://example.com/image.png)' })
  expect(editor.document).toEqual(before)
  expect(rejected).toHaveLength(1)
})
