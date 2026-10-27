import type { Document } from '@/content/document'
import type { Envelope } from '@/features/editor/workspace/document-model'
import { stableJSON } from '@/content/canonical'
import { validateDocument } from '@/content/document'
import { envelope } from '@/content/envelope'
import { allBlocks, allInlines, MEDIA_TYPES } from '@/content/tree'
import { documentAccessibility } from '@/features/editor/engine/document-accessibility'

// Block IDs are new identities; references within a copied footnote group follow them.
export function pastedDocument(
  fields: Envelope,
  current: unknown,
  pasted: unknown,
): {
  document: Document
  patch: Pick<Envelope, 'mediaAccessibility' | 'tableAccessibility'>
} {
  const normalized: unknown = JSON.parse(JSON.stringify(pasted))
  const existing = validateClipboardDocument(fields, current)
  const incoming = envelope.parse({
    ...fields,
    blocks: normalized,
    mediaAccessibility: {},
    tableAccessibility: {},
    references: fields.references,
  }).blocks
  const ids = new Map(
    Array.from(allBlocks(incoming), ({ block }) => [
      block.id,
      crypto.randomUUID(),
    ]),
  )
  const patch = {
    mediaAccessibility: { ...fields.mediaAccessibility },
    tableAccessibility: { ...fields.tableAccessibility },
  }
  for (const { block } of allBlocks(incoming)) {
    const original = block.id
    block.id = ids.get(original) ?? original
    remapNotes(block, ids)
    if (MEDIA_TYPES.has(block.type)) {
      patch.mediaAccessibility[block.id] = fields.mediaAccessibility[original] ?? {
        alt: '',
        decorative: false,
        transcript: '',
        captionAssetId: null,
        posterAssetId: null,
      }
    }
    if (block.type === 'table') {
      patch.tableAccessibility[block.id] = fields.tableAccessibility[original] ?? {
        caption: '',
      }
    }
  }
  const blocks = [
    ...existing.blocks,
    ...incoming,
  ]
  const combined = validateClipboardDocument({ ...fields, ...patch }, blocks)
  return { document: { ...combined, blocks: incoming }, patch }
}

export function validateClipboardDocument(fields: Envelope, current: unknown): Document {
  const normalized: unknown = JSON.parse(JSON.stringify(current))
  const blocks = envelope.parse({ ...fields, blocks: normalized }).blocks
  const document = validateDocument({ ...fields, blocks, ...documentAccessibility(fields, blocks) })
  if (new TextEncoder().encode(stableJSON(document)).byteLength > 524288) {
    throw new Error('Document exceeds the supported size.')
  }
  return document
}
function remapNotes(block: Document['blocks'][number], ids: Map<string, string>): void {
  for (const inline of allInlines(block)) {
    if (inline.type === 'footnoteRef') {
      inline.props.noteId = ids.get(inline.props.noteId) ?? inline.props.noteId
    }
  }
}
