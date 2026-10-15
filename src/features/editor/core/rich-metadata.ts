import type { DocumentModel } from '@/features/editor/core/model'
import type { RichContext } from '@/features/editor/core/rich-context'
import { useMemo } from 'react'

export function useRichMetadata(model: DocumentModel): RichContext {
  const rich = useMemo(
    () => ({
      references: model.envelope.references,
      footnotes: model.nodeItems
        .filter(node => node.type === 'footnote')
        .map(node => ({
          id: node.id,
          label: node.label,
        })),
    }),
    [model.envelope.references, model.nodeItems],
  )
  return rich
}
