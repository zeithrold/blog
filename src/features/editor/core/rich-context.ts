import type { Document } from '@/content/document'
import { createContext } from 'react'

export type RichContext = {
  references: Document['references']
  footnotes: {
    id: string
    label: string
  }[]
}

export const RichMetadataContext = createContext<RichContext>({
  references: [],
  footnotes: [],
})
