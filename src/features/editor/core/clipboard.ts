import type { Envelope } from '@/features/editor/core/model'
import type { editorSchema } from '@/features/editor/core/schema'
import DOMPurify from 'dompurify'
import { pastedDocument } from '@/features/editor/core/clipboard-document'
import { nativeBlocks } from '@/features/editor/core/native'
import { isPlainBlockSelection } from '@/features/editor/core/source-selection'

type Editor = typeof editorSchema.BlockNoteEditor
type PasteContext = {
  event: ClipboardEvent
  editor: Editor
  fields: Envelope
  update: (patch: Partial<Envelope>) => void
  reject: (message: string, text: string) => void
}

const tags = [
  'p',
  'div',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'code',
  'pre',
  'br',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'a',
]
const attributes = [
  'href',
  'start',
  'colspan',
  'rowspan',
  'data-node-type',
  'data-id',
  'data-content-type',
  'data-text-color',
  'data-background-color',
  'data-text-alignment',
  'data-level',
  'data-checked',
  'data-language',
  'data-tone',
  'data-title',
  'data-description',
  'data-url',
  'data-name',
  'data-caption',
  'data-reference-id',
  'data-locator',
  'data-note-id',
  'data-source',
  'data-provider',
  'data-video-id',
  'data-inline-content-type',
]

export function paste(context: PasteContext): boolean {
  const data = context.event.clipboardData
  if (data === null) {
    return true
  }
  const text = data.getData('text/plain')
  const native = data.getData('blocknote/html')
  const html = native !== '' ? native : data.getData('text/html')
  if (data.files.length > 0) {
    context.reject('Use Upload media to attach validated files.', '')
    return true
  }
  if (text.length > 32768 || html.length > 131072) {
    context.reject('Clipboard exceeds the supported size. Paste a smaller section.', '')
    return true
  }
  if (context.editor.getTextCursorPosition().block.type === 'codeBlock' || isPlainBlockSelection(context.editor)
    || html === '') {
    context.editor.insertInlineContent([
      { type: 'text', text, styles: {} },
    ])
    return true
  }
  return pasteHTML(context, html, text)
}
function pasteHTML(context: PasteContext, html: string, text: string): true {
  try {
    const safe = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: tags,
      ALLOWED_ATTR: attributes,
      ALLOW_DATA_ATTR: false,
      FORBID_CONTENTS: [
        'script',
        'style',
        'iframe',
        'object',
        'svg',
        'math',
      ],
    })
    if (safe.trim() === '') {
      context.editor.insertInlineContent([
        { type: 'text', text, styles: {} },
      ])
      return true
    }
    const parsed = context.editor.tryParseHTMLToBlocks(safe)
    const { document, patch } = pastedDocument(
      context.fields,
      context.editor.document,
      parsed,
    )
    const blocks = nativeBlocks(document)
    const first = blocks[0]
    context.update(patch)
    if (blocks.length === 1 && first?.type === 'paragraph' && Array.isArray(first.content)) {
      context.editor.insertInlineContent(first.content)
    }
    else {
      context.editor.insertBlocks(
        blocks,
        context.editor.getTextCursorPosition().block,
        'after',
      )
    }
  }
  catch {
    context.reject(
      'This clipboard structure is unsupported. You can paste its plain text.',
      text,
    )
  }
  return true
}
