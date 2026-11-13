import type { NotionBindings } from './bindings'
import type { CatalogSnapshot, PublicItem } from '@/contracts/notion'
import { z } from 'zod'
import { publicItemSchema } from '@/contracts/notion'
import { nextCursor, notionClient, NotionContentError, pagination } from './api'
import { cacheKey, deadline, envelopeSchema, readCache, writeCache } from './cache'
import { parseMetadata } from './metadata'

const catalogSchema = envelopeSchema.extend({ items: z.array(publicItemSchema) })

export async function readCatalog(bindings: NotionBindings): Promise<CatalogSnapshot> {
  const key = cacheKey(bindings, 'catalog')
  const cached = await readCache(bindings, key, catalogSchema)
  if (cached !== null) {
    return cached
  }
  const fetchedAt = Date.now()
  const client = notionClient(bindings)
  const items: PublicItem[] = []
  const paths = new Set<string>()
  const seen = new Set<string>()
  let cursor: string | null = null
  do {
    const response = pagination(await client.dataSources.query({
      data_source_id: bindings.NOTION_DATA_SOURCE_ID,
      ...((cursor !== null) ? { start_cursor: cursor } : {}),
    }))
    for (const value of response.results) {
      const item = parseMetadata(value, bindings.NOTION_DATA_SOURCE_ID)
      if (item === null) {
        continue
      }
      if (paths.has(item.path)) {
        throw new NotionContentError(`Duplicate public path: ${item.path}`)
      }
      paths.add(item.path)
      items.push(item)
    }
    cursor = nextCursor(response.next_cursor, seen)
  } while (cursor !== null)
  items.sort((left, right) => {
    const dateOrder = right.publishedAt - left.publishedAt
    return dateOrder === 0 ? left.path.localeCompare(right.path) : dateOrder
  })
  const snapshot = {
    items,
    fetchedAt,
    freshUntil: deadline(fetchedAt, 60, items.map(item => item.cover?.expiresAt ?? null)),
  }
  await writeCache(bindings, key, snapshot)
  return snapshot
}
