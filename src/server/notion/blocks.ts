import type { ExtendedRecordMap, PageBlock } from 'notion-types'
import type { StoredBlock } from './block-shape'
import type { PublicItem, PublicPath } from '@/contracts/notion'
import { z } from 'zod'
import { NotionContentError, richTextSchema } from './api'
import { blockBase } from './block-shape'
import { mediaConverters } from './media-blocks'
import { decorations } from './rich-text'
import { structuralConverters } from './structural-blocks'
import { textConverters } from './text-blocks'

export { blockSchema, storedBlockSchema } from './block-shape'
export type { StoredBlock } from './block-shape'

const converters = { ...textConverters, ...structuralConverters, ...mediaConverters }

export function convertBlocks(
  item: PublicItem,
  blocks: readonly StoredBlock[],
  links: Readonly<Record<string, PublicPath>>,
): { readonly recordMap: ExtendedRecordMap, readonly mediaExpiresAt: number | null } {
  const root: PageBlock = {
    id: item.id,
    parent_id: '',
    parent_table: 'space',
    version: 1,
    created_time: item.publishedAt,
    last_edited_time: item.updatedAt,
    alive: true,
    created_by_table: 'notion_user',
    created_by_id: '',
    last_edited_by_table: 'notion_user',
    last_edited_by_id: '',
    content: blocks.filter(entry => entry.parentId === item.id).map(entry => entry.block.id),
    type: 'page',
    properties: { title: [
      [item.title],
    ] },
    format: item.cover === null ? {} : { page_cover: item.cover.url },
    permissions: [],
  }
  const recordMap: ExtendedRecordMap = {
    block: { [item.id]: { role: 'reader', value: root } },
    collection: {},
    collection_view: {},
    notion_user: {},
    collection_query: {},
    signed_urls: {},
  }
  const coverExpiry = item.cover?.expiresAt ?? null
  const expiries: number[] = coverExpiry === null ? [] : [coverExpiry]
  for (const entry of blocks) {
    if (entry.block.in_trash) {
      throw new NotionContentError('Deleted block in page body')
    }
    const convert = converters[entry.block.type]
    if (convert === undefined) {
      throw new NotionContentError(`Unsupported Notion block: ${entry.block.type}`)
    }
    const block = convert({
      base: blockBase(entry),
      data: entry.block[entry.block.type],
      blocks,
      links,
      rich: value => decorations(z.array(richTextSchema).parse(value), links),
      expiries,
    })
    recordMap.block[entry.block.id] = { role: 'reader', value: block }
  }
  return { recordMap, mediaExpiresAt: expiries.length === 0 ? null : Math.min(...expiries) }
}
