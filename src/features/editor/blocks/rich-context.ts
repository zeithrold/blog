import type { Document } from '@/content/document'
import { createContext } from 'react'

export type RichContext = {
  citationNumbers: Map<string, number>
  noteNumbers: Map<string, number>
  references: Document['references']
  footnotes: {
    id: string
    label: string
  }[]
}

export const RichMetadataContext = createContext<RichContext>({
  citationNumbers: new Map(),
  noteNumbers: new Map(),
  references: [],
  footnotes: [],
})
