import type { NotionBindings } from './bindings'
import type { CatalogSnapshot, PageSnapshot, PublicItem, PublicPath } from '@/contracts/notion'
import { APIErrorCode, isNotionClientError } from '@notionhq/client'
import { z } from 'zod'
import { canonicalId, notionClient } from './api'
import { convertBlocks, storedBlockSchema } from './blocks'
import { cacheKey, deadline, envelopeSchema, readCache, writeCache } from './cache'
import { readCatalog } from './catalog'
import { fetchBlocks } from './fetch-blocks'
import { parseMetadata } from './metadata'

const bodySchema = envelopeSchema.extend({
  updatedAt: z.number(),
  blocks: z.array(storedBlockSchema),
})

async function currentMetadata(bindings: NotionBindings, id: string) {
  try {
    return parseMetadata(await notionClient(bindings).pages.retrieve({ page_id: id }), bindings.NOTION_DATA_SOURCE_ID)
  }
  catch (error) {
    if (isNotionClientError(error) && error.code === APIErrorCode.ObjectNotFound) {
      return null
    }
    throw error
  }
}

export async function readPageMetadata(bindings: NotionBindings, path: PublicPath): Promise<{
  readonly item: PublicItem
  readonly catalog: CatalogSnapshot
} | null> {
  const catalog = await readCatalog(bindings)
  const selected = catalog.items.find(item => item.path === path)
  if (selected === undefined) {
    return null
  }
  const item = await currentMetadata(bindings, selected.id)
  if (item === null || item.path !== path) {
    return null
  }
  return { item, catalog }
}

export async function readPage(bindings: NotionBindings, path: PublicPath): Promise<PageSnapshot | null> {
  const fetchedAt = Date.now()
  const selected = await readPageMetadata(bindings, path)
  if (selected === null) {
    return null
  }
  const { item, catalog } = selected
  const pageLinks = Object.fromEntries(catalog.items.map(entry => [
    canonicalId(entry.id),
    entry.path,
  ]))
  pageLinks[canonicalId(item.id)] = item.path
  const key = cacheKey(bindings, `page:${item.id}`)
  const cached = await readCache(bindings, key, bodySchema)
  const current = cached?.updatedAt === item.updatedAt ? cached : null
  const blocks = current?.blocks ?? await fetchBlocks(notionClient(bindings), item, pageLinks)
  const converted = convertBlocks(item, blocks, pageLinks)
  const start = current === null ? fetchedAt : current.fetchedAt
  const freshUntil = deadline(start, 300, [converted.mediaExpiresAt])
  if (current === null) {
    await writeCache(bindings, key, { blocks, updatedAt: item.updatedAt, fetchedAt: start, freshUntil })
  }
  return { item, ...converted, pageLinks, fetchedAt: start, freshUntil }
}
