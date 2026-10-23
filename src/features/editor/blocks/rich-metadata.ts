import type { RichContext } from '@/features/editor/blocks/rich-context'
import type { DocumentModel } from '@/features/editor/workspace/document-model'
import { useMemo } from 'react'
import { referenceOrder } from '@/content/reference-order'

export function useRichMetadata(model: DocumentModel): RichContext {
  const { nodeItems, envelope, editor } = model
  const references = envelope.references
  const rich = useMemo(
    () => {
      const indexed = new Map(nodeItems.map(node => [node.id, node]))
      const notes = nodeItems.filter(node => node.type === 'footnote')
        .map(node => editor.getBlock(node.id))
        .filter(node => node !== undefined)
      const ordered = referenceOrder(editor.document, notes).flatMap(block => indexed.get(block.id) ?? [])
      return {
        citationNumbers: numbered(ordered, 'references', references.map(ref => ref.id)),
        noteNumbers: numbered(
          ordered,
          'footnotes',
          nodeItems.filter(node => node.type === 'footnote').map(node => node.id),
        ),
        references,
        footnotes: nodeItems
          .filter(node => node.type === 'footnote')
          .map(node => ({
            id: node.id,
            label: node.label,
          })),
      }
    },
    [
      references,
      nodeItems,
      editor,
    ],
  )
  return rich
}

function numbered(
  nodes: DocumentModel['nodeItems'],
  key: 'references' | 'footnotes',
  remaining: string[],
): Map<string, number> {
  const ids = new Set([
    ...nodes.flatMap(node => node[key]),
    ...remaining,
  ].filter(id => id !== ''))
  return new Map(Array.from(ids, (id, index) => [
    id,
    index + 1,
  ]))
}
