import type { ExtendedRecordMap } from 'notion-types'
import { Client } from '@notionhq/client'
import { NotionCompatAPI } from 'notion-compat'
import { getBlogConfig } from '@/lib/config'
import { buildRecordMapCacheKey, withNotionCache } from '@/lib/notion/cache'

let notionCompat: NotionCompatAPI | null = null

/**
 * NotionCompatAPI uses the official @notionhq/client (integration token).
 */
function getNotionCompat() {
  if (!notionCompat) {
    const { token } = getBlogConfig().notion
    notionCompat = new NotionCompatAPI(new Client({ auth: token }))
  }
  return notionCompat
}

/**
 * Fetch page blocks as a react-notion-x record map via the official Notion API.
 */
export async function getPageRecordMap(pageId: string): Promise<ExtendedRecordMap> {
  const key = buildRecordMapCacheKey(pageId)
  return withNotionCache(key, async () => getNotionCompat().getPage(pageId))
}
