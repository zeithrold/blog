import type { Transaction } from 'prosemirror-state'
import type { editorSchema } from '@/features/editor/engine/schema'
import type { Envelope } from '@/features/editor/workspace/document-model'
import DOMPurify from 'dompurify'
import { DOMParser as ProseMirrorDOMParser, Slice } from 'prosemirror-model'
import { isPlainBlockSelection } from '@/features/editor/blocks/source/source-selection'
import { pastedDocument, validateClipboardDocument } from '@/features/editor/engine/clipboard-document'
import { nativeBlocks } from '@/features/editor/engine/native'

type Editor = typeof editorSchema.BlockNoteEditor
type PasteContext = {
  event: ClipboardEvent
  editor: Editor
  fields: Envelope
  plainText?: boolean
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
  const markdown = data.getData('text/markdown')
  const native = data.getData('blocknote/html')
  const html = native !== '' ? native : data.getData('text/html')
  if (data.files.length > 0) {
    context.reject('Use Upload media to attach validated files.', '')
    return true
  }
  if (text.length > 32768 || markdown.length > 32768 || html.length > 131072) {
    context.reject('Clipboard exceeds the supported size. Paste a smaller section.', '')
    return true
  }
  if (plainPaste(context)) {
    pastePlainText(context.editor, text !== '' ? text : markdown)
    return true
  }
  return pasteFormatted(context, {
    html,
    markdown: native === '' ? markdown : '',
    text,
  })
}

function plainPaste(context: Pick<PasteContext, 'editor' | 'plainText'>): boolean {
  return context.plainText === true
    || context.editor.getTextCursorPosition().block.type === 'codeBlock'
    || isPlainBlockSelection(context.editor)
}

export function pastePlainText(editor: Editor, text: string): void {
  if (plainPaste({ editor })) {
    editor.transact(tr => tr.insertText(text.replace(/\r\n?/g, '\n')))
    return
  }
  editor.insertInlineContent([
    { type: 'text', text, styles: {} },
  ])
}

function pasteFormatted(
  context: PasteContext,
  source: { html: string, markdown: string, text: string },
): true {
  try {
    const markdown = source.markdown !== '' || source.html === ''
    const safe = markdown ? '' : sanitizeHTML(source.html)
    if (!markdown && safe.trim() === '') {
      pastePlainText(context.editor, source.text)
      return true
    }
    const parsed = markdown
      ? context.editor.tryParseMarkdownToBlocks(source.markdown !== '' ? source.markdown : source.text)
      : context.editor.tryParseHTMLToBlocks(safe)
    const { document, patch } = pastedDocument(
      context.fields,
      context.editor.document,
      parsed,
    )
    const html = context.editor.blocksToFullHTML(nativeBlocks(document))
    const container = window.document.createElement('div')
    container.innerHTML = html
    const parsedSlice = ProseMirrorDOMParser.fromSchema(context.editor.pmSchema).parseSlice(container)
    // Never open through isolating table/cell nodes when fitting the slice.
    const slice = Slice.maxOpen(parsedSlice.content, false)
    context.editor.transact((tr) => {
      tr.replaceSelection(slice).scrollIntoView()
      assignSplitIDs(tr)
      // document reads the active transaction. Throwing here aborts dispatch,
      // so nesting/size violations never enter the editor or its undo history.
      validateClipboardDocument({ ...context.fields, ...patch }, context.editor.document)
      context.update(patch)
    })
  }
  catch {
    context.reject(
      'This clipboard structure is unsupported. You can paste its plain text.',
      source.text !== '' ? source.text : source.markdown,
    )
  }
  return true
}

function assignSplitIDs(tr: Transaction): void {
  const seen = new Set<string>()
  // Fitting can split an existing paragraph, copying its ID to both halves.
  // Assign the new half's identity before validation, rather than waiting for
  // BlockNote's post-dispatch UniqueID plugin.
  tr.doc.descendants((node, position) => {
    if (node.type.name !== 'blockContainer') {
      return
    }
    const id: unknown = node.attrs.id
    const next = typeof id === 'string' && !seen.has(id) ? id : crypto.randomUUID()
    seen.add(next)
    if (next !== id) {
      tr.setNodeMarkup(position, undefined, { ...node.attrs, id: next })
    }
  })
}

function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
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
}
