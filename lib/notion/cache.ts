import { createHash } from 'node:crypto'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getBlogConfig } from '@/lib/config'

export const NOTION_CACHE_TTL_SECONDS = 300

interface NotionKvBinding {
  get: (key: string, type: 'json') => Promise<unknown>
  put: (key: string, value: string, options: { expirationTtl: number }) => Promise<void>
}

/**
 * Short hash of the Notion token so cache keys change when credentials change.
 */
function getTokenHash(): string {
  const { token } = getBlogConfig().notion
  return createHash('sha256').update(token).digest('hex').slice(0, 8)
}

/**
 *
 */
function hashBody(body: string): string {
  if (body === '')
    return ''
  return createHash('sha256').update(body).digest('hex').slice(0, 16)
}

/**
 * Cache key for official REST `notionFetch` calls.
 */
export function buildNotionRestCacheKey(method: string, path: string, body: string): string {
  const parts = [`notion:${getTokenHash()}:${method.toUpperCase()}:${path}`]
  const bodyHash = hashBody(body)
  if (bodyHash !== '')
    parts.push(bodyHash)
  return parts.join(':')
}

/**
 * Cache key for `getPageRecordMap` (notion-compat full page tree).
 */
export function buildRecordMapCacheKey(pageId: string): string {
  return `notion:${getTokenHash()}:recordMap:${pageId}`
}

/**
 *
 */
async function getKv(): Promise<NotionKvBinding | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    const kv = (env as { KV?: NotionKvBinding }).KV
    if (kv === undefined)
      return null
    return kv
  }
  catch {
    return null
  }
}

/**
 * Run `fetcher` with a TTL cache in Cloudflare KV (or local Miniflare simulation in dev).
 * Errors from `fetcher` are not cached. Falls back to uncached fetch when KV is unavailable.
 */
export async function withNotionCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const kv = await getKv()

  if (kv !== null) {
    const cached = await kv.get(key, 'json')
    if (cached !== null)
      return cached as T
  }

  const data = await fetcher()

  if (kv !== null) {
    await kv.put(key, JSON.stringify(data), { expirationTtl: NOTION_CACHE_TTL_SECONDS })
  }

  return data
}
