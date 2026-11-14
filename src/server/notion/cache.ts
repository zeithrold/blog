import type { NotionBindings } from './bindings'
import { z } from 'zod'

export const envelopeSchema = z.object({
  fetchedAt: z.number(),
  freshUntil: z.number(),
})

export function cacheKey(bindings: NotionBindings, suffix: string): string {
  const version = suffix === 'catalog' ? 'v2' : 'v1'
  return `notion:${version}:${bindings.NOTION_DATA_SOURCE_ID}:${suffix}`
}

export function deadline(start: number, seconds: number, expiries: readonly (number | null)[]): number {
  return Math.min(start + seconds * 1000, ...expiries.filter(value => value !== null).map(value => value - 60_000))
}

export async function readCache<T>(bindings: NotionBindings, key: string, schema: z.ZodType<T>): Promise<T | null> {
  const raw: unknown = await bindings.NOTION_CACHE.get(key, 'json')
  if (raw === null) {
    return null
  }
  const envelope = envelopeSchema.parse(raw)
  if (envelope.freshUntil <= Date.now()) {
    return null
  }
  return schema.parse(raw)
}

export async function writeCache<T extends { readonly fetchedAt: number, readonly freshUntil: number }>(
  bindings: NotionBindings,
  key: string,
  value: T,
): Promise<void> {
  const remaining = value.freshUntil - Date.now()
  if (remaining > 0) {
    const ttl = Math.max(60, Math.ceil(remaining / 1000))
    await bindings.NOTION_CACHE.put(key, JSON.stringify(value), { expirationTtl: ttl })
  }
}
