import type { Document } from '@/content/document'
import { MEDIA_TYPES } from '@/content/tree'

type Accessibility = Pick<Document, 'mediaAccessibility' | 'tableAccessibility'>
type Block = { id: string, type: string, children: Block[] }

// Keep the editor's maps intact for undo; prune only the document being validated or saved.
export function documentAccessibility(fields: Accessibility, blocks: Block[]): Accessibility {
  const tables = new Set<string>()
  const media = new Set<string>()
  const walk = (items: Block[]): void => {
    for (const block of items) {
      if (block.type === 'table') {
        tables.add(block.id)
      }
      if (MEDIA_TYPES.has(block.type)) {
        media.add(block.id)
      }
      walk(block.children)
    }
  }
  walk(blocks)
  return {
    tableAccessibility: Object.fromEntries(
      Object.entries(fields.tableAccessibility).filter(([id]) => tables.has(id)),
    ),
    mediaAccessibility: Object.fromEntries(
      Object.entries(fields.mediaAccessibility).filter(([id]) => media.has(id)),
    ),
  }
}
