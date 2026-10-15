import type { Block } from '@/content/blocks'
import type { Inline } from '@/content/inline'

export function* allBlocks(
  blocks: Block[],
  depth = 1,
): Generator<{
  block: Block
  depth: number
}> {
  for (const block of blocks) {
    yield {
      block,
      depth,
    }
    yield* allBlocks(block.children, depth + 1)
  }
}
export function inlineArrays(block: Block): Inline[][] {
  if (Array.isArray(block.content)) {
    return [block.content]
  }
  if (block.content === undefined) {
    return []
  }
  return block.content.rows.flatMap(row =>
    row.cells.map(cell => (Array.isArray(cell) ? cell : cell.content)),
  )
}
export function* allInlines(block: Block): Generator<Inline> {
  for (const array of inlineArrays(block)) {
    for (const item of array) {
      yield item
      if (item.type === 'link') {
        yield* item.content
      }
    }
  }
}
export function blockSource(block: Block): string {
  return Array.from(allInlines(block))
    .map(item => (item.type === 'text' ? item.text : ''))
    .join('')
}
export const MEDIA_TYPES = new Set([
  'image',
  'audio',
  'video',
  'file',
])
export const ATOMIC_TYPES = new Set([
  'divider',
  'toc',
  'linkCard',
  'embed',
  ...MEDIA_TYPES,
])
