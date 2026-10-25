'use client'
import type { ReactNode } from 'react'
import { emptyDocument } from '@/content/document'
import { DocumentReader } from '@/features/reader/document'
import { EDITOR_MATH_SOURCES } from '../support/editor-fixtures'

/** Reader geometry uses the actual responsive reader and typography ancestors. */
export function EditorMathSurface(): ReactNode {
  const document = emptyDocument()
  document.blocks = EDITOR_MATH_SOURCES.map(source => ({
    id: crypto.randomUUID(),
    type: 'math' as const,
    props: {},
    content: [
      { type: 'text' as const, text: source, styles: {} },
    ],
    children: [],
  }))
  return <DocumentReader document={document} />
}
