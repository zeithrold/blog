import type { Document } from '@/content/document'
import type { PublicationBlock, PublicationNode } from '@/content/publication-nodes'
import type { editorSchema } from '@/features/editor/core/schema'
import { publicationNode } from '@/content/publication-nodes'

export function nativeBlocks(document: Document): (typeof editorSchema.PartialBlock)[] {
  const blocks = structuredClone(document.blocks)
  const walk = (items: Document['blocks']): void => {
    for (const node of items) {
      if (node.content !== undefined && !Array.isArray(node.content)) {
        node.content.columnWidths = node.content.columnWidths.map(
          width => width ?? undefined,
        )
      }
      walk(node.children)
    }
  }
  walk(blocks)
  // eslint-disable-next-line ts/no-unsafe-type-assertion -- Validated native schema; normalized wire column slots.
  return blocks as (typeof editorSchema.PartialBlock)[]
}
export type NodeItem = PublicationNode & { label: string }

export function nodes(document: Document): NodeItem[] {
  const result: NodeItem[] = []
  const walk = (blocks: Document['blocks']): void => {
    for (const block of blocks) {
      result.push(nodeItem(block))
      walk(block.children)
    }
  }
  walk(document.blocks)
  return result
}

export function nodeItem(block: PublicationBlock): NodeItem {
  return {
    ...publicationNode(block),
    label: block.type === 'footnote' ? inlineLabel(block.content) : '',
  }
}
function inlineLabel(content: unknown): string {
  if (!Array.isArray(content)) {
    return 'Footnote'
  }
  let result = ''
  for (const value of content) {
    const inline: unknown = value
    if (inline !== null && typeof inline === 'object') {
      const text: unknown = Reflect.get(inline, 'text')
      if (typeof text === 'string') {
        result += text.slice(0, 80)
      }
    }
    if (result.length >= 80) {
      break
    }
  }
  return result === '' ? 'Footnote' : result.slice(0, 80)
}
export function sameNode(
  left: PublicationBlock,
  right: PublicationBlock,
): boolean {
  const before = nodeItem(left)
  const after = nodeItem(right)
  return (
    before.type === after.type
    && before.label === after.label
    && sameIds(before.references, after.references)
    && sameIds(before.footnotes, after.footnotes)
    && before.missingMediaSource === after.missingMediaSource
    && before.invalidDiagram === after.invalidDiagram
  )
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}
