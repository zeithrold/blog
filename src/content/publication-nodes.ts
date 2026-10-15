import { validDiagram } from '@/content/diagram-policy'
import { MEDIA_TYPES } from '@/content/tree'

export type PublicationBlock = { id: string, type: string, content?: unknown, props?: unknown }
export type PublicationNode = {
  id: string
  type: string
  references: string[]
  footnotes: string[]
  missingMediaSource: boolean
  invalidDiagram: boolean
}

export function publicationNode(block: PublicationBlock): PublicationNode {
  const references: string[] = []
  const footnotes: string[] = []
  let source = ''
  for (const inline of inlineObjects(block.content)) {
    const type = field(inline, 'type')
    const props = field(inline, 'props')
    const reference = field(props, 'referenceId')
    const footnote = field(props, 'noteId')
    if (type === 'citation' && typeof reference === 'string') {
      references.push(reference)
    }
    if (type === 'footnoteRef' && typeof footnote === 'string') {
      footnotes.push(footnote)
    }
    if (block.type === 'mermaid') {
      source += inlineText(inline)
    }
  }
  return {
    id: block.id,
    type: block.type,
    references,
    footnotes,
    missingMediaSource: MEDIA_TYPES.has(block.type) && field(block.props, 'url') === '',
    invalidDiagram: block.type === 'mermaid' && !validDiagram(source),
  }
}

function inlineText(inline: object): string {
  const text = field(inline, 'text')
  return field(inline, 'type') === 'text' && typeof text === 'string' ? text : ''
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? Reflect.get(value, key) : undefined
}
function* inlineObjects(content: unknown): Generator<object> {
  if (!Array.isArray(content)) {
    yield* tableInlines(content)
    return
  }
  for (const value of content) {
    const inline: unknown = value
    if (inline !== null && typeof inline === 'object') {
      yield inline
      if (field(inline, 'type') === 'link') {
        yield* inlineObjects(field(inline, 'content'))
      }
    }
  }
}
function* tableInlines(content: unknown): Generator<object> {
  const rows = field(content, 'rows')
  if (field(content, 'type') !== 'tableContent' || !Array.isArray(rows)) {
    return
  }
  for (const row of rows) {
    const cells = field(row, 'cells')
    if (Array.isArray(cells)) {
      for (const cell of cells) {
        yield* inlineObjects(Array.isArray(cell) ? cell : field(cell, 'content'))
      }
    }
  }
}
