import type { Document } from '@/content/envelope'
import type { Inline } from '@/content/inline'
import { allBlocks, inlineArrays } from '@/content/tree'

function inlineText(item: Inline): string {
  if (item.type === 'text') {
    return item.text
  }
  if (item.type === 'link') {
    return item.content.map(inlineText).join('')
  }
  if (item.type === 'inlineMath') {
    return item.props.source
  }
  return ''
}
export function extractText(document: Document): string {
  const result = [document.meta.title, document.meta.description]
  for (const { block } of allBlocks(document.blocks)) {
    result.push(...inlineArrays(block).map(items => items.map(inlineText).join('')))
    for (const field of [
      'title',
      'caption',
      'description',
    ]) {
      const value = block.props[field]
      if (typeof value === 'string') {
        result.push(value)
      }
    }
  }
  for (const item of Object.values(document.mediaAccessibility)) {
    result.push(item.alt, item.transcript)
  }
  for (const item of Object.values(document.tableAccessibility)) {
    result.push(item.caption)
  }
  for (const reference of document.references) {
    result.push(
      reference.title,
      reference.authors.join(', '),
      String(reference.year ?? ''),
      reference.doi,
    )
  }
  return result.join('\n')
}
