import type { Block } from '@/content/blocks'
import type { Document } from '@/content/document'
import type { Inline } from '@/content/inline'
import { stableJSON } from '@/content/canonical'
import { inlineArrays } from '@/content/tree'

type LocatedBlock = {
  block: Block
  parent: string | null
}

export type FieldDifference = {
  key: string
  before: unknown
  after: unknown
}

export type BlockDifference = {
  id: string
  type: string
  kind: 'added' | 'removed' | 'changed' | 'moved'
  moved: boolean
  before: string
  after: string
  fields: FieldDifference[]
}

export type RevisionDifference = {
  blocks: BlockDifference[]
  metadata: FieldDifference[]
  references: FieldDifference[]
  media: FieldDifference[]
  tables: FieldDifference[]
}

function locate(blocks: Block[]): Map<string, LocatedBlock> {
  const result = new Map<string, LocatedBlock>()
  const walk = (items: Block[], parent: string | null): void => {
    for (const block of items) {
      result.set(block.id, { block, parent })
      walk(block.children, block.id)
    }
  }
  walk(blocks, null)
  return result
}
function fields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldDifference[] {
  const keys = new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ])
  return Array.from(keys)
    .filter(key => stableJSON(before[key]) !== stableJSON(after[key]))
    .map(key => ({ key, before: before[key], after: after[key] }))
}
function text(item: Inline): string {
  switch (item.type) {
    case 'text': return item.text
    case 'link': return item.content.map(text).join('')
    case 'inlineMath': return item.props.source
    case 'citation': return `[citation ${item.props.referenceId} ${item.props.locator}]`
    case 'footnoteRef': return `[footnote ${item.props.noteId}]`
  }
}
function blockText(block: Block | undefined): string {
  return block === undefined
    ? ''
    : inlineArrays(block).map(items => items.map(text).join('')).join('\n')
}
function ranks(
  blocks: Map<string, LocatedBlock>,
  other: Map<string, LocatedBlock>,
): Map<string, number> {
  const counts = new Map<string | null, number>()
  const result = new Map<string, number>()
  for (const [id, item] of blocks) {
    if (other.get(id)?.parent !== item.parent) {
      continue
    }
    const rank = counts.get(item.parent) ?? 0
    result.set(id, rank)
    counts.set(item.parent, rank + 1)
  }
  return result
}
function compareBlocks(before: Block[], after: Block[]): BlockDifference[] {
  const previous = locate(before)
  const next = locate(after)
  const oldRanks = ranks(previous, next)
  const newRanks = ranks(next, previous)
  const result: BlockDifference[] = []
  for (const id of new Set([
    ...next.keys(),
    ...previous.keys(),
  ])) {
    const old = previous.get(id)
    const current = next.get(id)
    const moved = old !== undefined && current !== undefined
      && (old.parent !== current.parent || oldRanks.get(id) !== newRanks.get(id))
    const difference = compareBlock(id, old?.block, current?.block, moved)
    if (difference !== null) {
      result.push(difference)
    }
  }
  return result
}
function blockValues(block: Block | undefined): Record<string, unknown> {
  return block === undefined ? {} : { type: block.type, props: block.props, content: block.content }
}
function changeKind(before: Block | undefined, after: Block | undefined, changed: boolean): BlockDifference['kind'] {
  if (before === undefined) {
    return 'added'
  }
  if (after === undefined) {
    return 'removed'
  }
  return changed ? 'changed' : 'moved'
}
function compareBlock(
  id: string,
  before: Block | undefined,
  after: Block | undefined,
  moved: boolean,
): BlockDifference | null {
  const changed = fields(blockValues(before), blockValues(after))
  if (changed.length === 0 && !moved) {
    return null
  }
  return {
    id,
    type: after?.type ?? before?.type ?? '',
    kind: changeKind(before, after, changed.length > 0),
    moved,
    before: blockText(before),
    after: blockText(after),
    fields: changed,
  }
}
export function compareRevisions(before: Document, after: Document): RevisionDifference {
  return {
    blocks: compareBlocks(before.blocks, after.blocks),
    metadata: fields(before.meta, after.meta),
    references: fields(
      Object.fromEntries(before.references.map(reference => [reference.id, reference])),
      Object.fromEntries(after.references.map(reference => [reference.id, reference])),
    ),
    media: fields(before.mediaAccessibility, after.mediaAccessibility),
    tables: fields(before.tableAccessibility, after.tableAccessibility),
  }
}
