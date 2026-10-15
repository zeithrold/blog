import type { Block } from '@/content/blocks'
import type { Document } from '@/content/envelope'
import type { Inline } from '@/content/inline'
import { ContentError, requireContent, SLUG } from '@/content/base'
import { props } from '@/content/blocks'
import { validDiagram } from '@/content/diagram-policy'
import { envelope } from '@/content/envelope'
import { inspectJSON } from '@/content/json-inspect'
import { publicationRequirements } from '@/content/publication-validation'
import { validateTable } from '@/content/table-validation'
import { allBlocks, allInlines, ATOMIC_TYPES, blockSource, MEDIA_TYPES } from '@/content/tree'

type Context = {
  document: Document
  publish: boolean
  ids: Set<string>
  tables: Set<string>
  media: Set<string>
  footnotes: Set<string>
  references: Set<string>
  inlineCount: number
  mathCount: number
  diagramCount: number
}

function validateInline(item: Inline, context: Context): void {
  context.inlineCount++
  if (item.type === 'citation') {
    const id = item.props.referenceId
    requireContent(!context.publish || context.references.has(id))
  }
  if (item.type === 'footnoteRef') {
    const id = item.props.noteId
    requireContent(!context.publish || context.footnotes.has(id))
  }
  if (item.type === 'inlineMath') {
    context.mathCount++
  }
}
function validateSource(block: Block, context: Context): void {
  const source = blockSource(block)
  requireContent(
    Array.from(allInlines(block)).every(
      item => item.type === 'text' && Object.keys(item.styles).length === 0,
    ),
  )
  const bounds: Record<string, number> = {
    codeBlock: 32768,
    math: 4096,
    mermaid: 16384,
  }
  const type = block.type
  requireContent(source.length <= (bounds[type] ?? 0))
  if (type === 'math') {
    context.mathCount++
  }
  if (type === 'mermaid') {
    if (context.publish) {
      requireContent(validDiagram(source))
    }
    context.diagramCount++
  }
}
function validateMedia(block: Block, context: Context): void {
  context.media.add(block.id)
  const accessibility = context.document.mediaAccessibility[block.id]
  if (!context.publish) {
    return
  }
  requireContent(block.props.url !== '' && accessibility !== undefined)
  if (block.type === 'image') {
    requireContent(accessibility.decorative || accessibility.alt.trim() !== '')
  }
  if (block.type === 'audio' || block.type === 'video') {
    requireContent(accessibility.transcript.trim() !== '')
  }
}
function validateContent(block: Block, context: Context): void {
  requireContent(props[block.type].safeParse(block.props).success)
  if (ATOMIC_TYPES.has(block.type)) {
    requireContent(block.content === undefined)
    if (MEDIA_TYPES.has(block.type)) {
      validateMedia(block, context)
    }
    return
  }
  if (block.type === 'table') {
    requireContent(block.content !== undefined && !Array.isArray(block.content))
    validateTable(block.content)
    context.tables.add(block.id)
    if (context.publish) {
      requireContent(Boolean(context.document.tableAccessibility[block.id]?.caption.trim()))
    }
    return
  }
  requireContent(Array.isArray(block.content))
  if ([
    'codeBlock',
    'math',
    'mermaid',
  ].includes(block.type)) {
    validateSource(block, context)
  }
}
function validateMetadata(context: Context): void {
  const doc = context.document
  requireContent(Object.keys(doc.tableAccessibility).every(id => context.tables.has(id)))
  requireContent(Object.keys(doc.mediaAccessibility).every(id => context.media.has(id)))
  requireContent(new Set(doc.meta.tags.map(tag => tag.id)).size === doc.meta.tags.length)
  requireContent(
    new Set(doc.meta.series.map(series => series.id)).size === doc.meta.series.length,
  )
  requireContent(context.references.size === doc.references.length)
  requireContent(context.inlineCount <= 100000)
  requireContent(context.mathCount <= 100 && context.diagramCount <= 30)
  if (!context.publish) {
    return
  }
  requireContent(doc.meta.title.trim() !== '' && SLUG.safeParse(doc.meta.slug).success)
  requireContent(![
    'admin',
    'api',
    'assets',
    'search',
    'licenses',
  ].includes(doc.meta.slug))
}
export function validateDocument(value: unknown, publish = false): Document {
  inspectJSON(value)
  const parsed = envelope.safeParse(value)
  if (!parsed.success) {
    throw new ContentError()
  }
  const document = parsed.data
  if (publish) {
    const issues = publicationRequirements(document)
    if (issues.length > 0) {
      throw new ContentError('PUBLICATION_INVALID', 422, issues)
    }
  }
  const context: Context = {
    document,
    publish,
    ids: new Set(),
    tables: new Set(),
    media: new Set(),
    footnotes: new Set(
      Array.from(allBlocks(document.blocks))
        .filter(({ block }) => block.type === 'footnote')
        .map(({ block }) => block.id),
    ),
    references: new Set(document.references.map(reference => reference.id)),
    inlineCount: 0,
    mathCount: 0,
    diagramCount: 0,
  }
  for (const { block, depth } of allBlocks(document.blocks)) {
    requireContent(depth <= 8 && context.ids.size < 2000 && !context.ids.has(block.id))
    context.ids.add(block.id)
    validateContent(block, context)
    for (const item of allInlines(block)) {
      validateInline(item, context)
    }
  }
  validateMetadata(context)
  return document
}
