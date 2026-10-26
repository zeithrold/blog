import type { Block } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import { EDITOR_MATH_SOURCES } from '~/tests/components/support/editor-fixtures'
import {
  codeBlock,
  editorWorkspaceDocument,
  paragraphBlock,
} from '~/tests/components/support/editor-workspace-fixtures'

export type SourceKind = 'math' | 'mermaid'

export const sourceText: Record<SourceKind, string> = {
  math: 'x=1',
  mermaid: 'graph TD\nA-->B',
}

export const codeText = 'def greet(name):\n    return "hello" + name'

export function sourceDocument(
  kind: SourceKind,
  layout: 'before' | 'lone' | 'around' = 'before',
): OpenDocument {
  const source = sourceBlock(kind)
  const kept = paragraphBlock('Keep this paragraph')
  let blocks: Block[]
  switch (layout) {
    case 'lone': {
      blocks = [source]
      break
    }
    case 'around': {
      blocks = [
        kept,
        source,
        paragraphBlock('After source'),
      ]
      break
    }
    case 'before': {
      blocks = [source, kept]
    }
  }
  return editorWorkspaceDocument('Source interaction', (document) => {
    document.blocks = blocks
  })
}

export function codeDocument(language = 'text', source = codeText): OpenDocument {
  return editorWorkspaceDocument('Code language', (document) => {
    document.blocks = [
      codeBlock(source, language),
    ]
  })
}

export function formulaDocument(source?: string): OpenDocument {
  return editorWorkspaceDocument('Inline formula', (document) => {
    const paragraph = paragraphBlock('An inline formula ')
    if (source !== undefined) {
      paragraph.content = [
        { type: 'text', text: 'An inline formula ', styles: {} },
        { type: 'inlineMath', props: { source } },
      ]
    }
    document.blocks = [paragraph]
  })
}

export function mathPreviewDocument(): OpenDocument {
  return editorWorkspaceDocument('Formula previews', (document) => {
    document.blocks = EDITOR_MATH_SOURCES.map((source, index): Block => ({
      id: `55555555-5555-4555-8555-${String(index + 1).padStart(12, '0')}`,
      type: 'math',
      props: {},
      content: [
        { type: 'text', text: source, styles: {} },
      ],
      children: [],
    }))
  })
}

export function inlineMathPreviewDocument(): OpenDocument {
  return editorWorkspaceDocument('Inline formula preview', (document) => {
    const paragraph = paragraphBlock('')
    paragraph.content = [
      { type: 'text', text: 'Inline formula ', styles: {} },
      { type: 'inlineMath', props: { source: 'a^2' } },
    ]
    document.blocks = [paragraph]
  })
}

function sourceBlock(kind: SourceKind): Block {
  return {
    id: kind === 'math'
      ? '11111111-1111-4111-8111-111111111111'
      : '22222222-2222-4222-8222-222222222222',
    type: kind,
    props: kind === 'mermaid' ? { description: 'A diagram' } : {},
    content: [
      { type: 'text', text: sourceText[kind], styles: {} },
    ],
    children: [],
  }
}
