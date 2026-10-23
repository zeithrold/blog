import type { Block, Document, Inline } from '@/content/document'
import { referenceOrder } from '@/content/reference-order'
import { allBlocks, inlineArrays } from '@/content/tree'

export type ReaderContext = {
  document: Document
  privatePreview: boolean
  citations: Map<string, number>
  notes: Map<string, number>
  noteReturns: Map<string, string>
  footnotes: Block[]
}

function reference(item: Inline, anchor: string, context: ReaderContext): void {
  if (item.type === 'citation' && item.props.referenceId !== '') {
    if (!context.citations.has(item.props.referenceId)) {
      context.citations.set(item.props.referenceId, context.citations.size + 1)
    }
  }
  if (item.type === 'footnoteRef' && item.props.noteId !== '') {
    if (!context.notes.has(item.props.noteId)) {
      context.notes.set(item.props.noteId, context.notes.size + 1)
    }
    if (!context.noteReturns.has(item.props.noteId)) {
      context.noteReturns.set(item.props.noteId, anchor)
    }
  }
}
export function readerContext(document: Document, privatePreview: boolean): ReaderContext {
  const footnotes = Array.from(allBlocks(document.blocks))
    .map(item => item.block)
    .filter(block => block.type === 'footnote')
  const context: ReaderContext = {
    document,
    privatePreview,
    footnotes,
    citations: new Map(),
    notes: new Map(),
    noteReturns: new Map(),
  }
  const ordered = referenceOrder(document.blocks, footnotes)
  for (const block of ordered) {
    let offset = 0
    for (const items of inlineArrays(block)) {
      items.forEach((item, index) => {
        reference(item, `note-ref-${block.id}-${offset + index}`, context)
      })
      offset += items.length
    }
  }
  for (const ref of document.references) {
    if (!context.citations.has(ref.id)) {
      context.citations.set(ref.id, context.citations.size + 1)
    }
  }
  for (const note of footnotes) {
    if (!context.notes.has(note.id)) {
      context.notes.set(note.id, context.notes.size + 1)
    }
  }
  return context
}
export function mediaURL(context: ReaderContext, assetId: string): string {
  return context.privatePreview
    ? `/api/admin/assets/${assetId}/content`
    : `/assets/${assetId}`
}
