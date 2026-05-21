import type { BlogConfig } from './schema'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { BlogConfigSchema } from './schema'

let cached: BlogConfig | null = null

/**
 *
 */
export function getBlogConfig(): BlogConfig {
  if (cached)
    return cached

  const b64 = process.env.BLOG_CONFIG_B64
  const json = process.env.BLOG_CONFIG
  const raw = b64 != null && b64 !== ''
    ? Buffer.from(b64, 'base64').toString('utf-8')
    : json

  if (raw == null || raw === '') {
    throw new Error('Missing BLOG_CONFIG_B64 or BLOG_CONFIG environment variable')
  }

  cached = BlogConfigSchema.parse(JSON.parse(raw))
  return cached
}

/**
 *
 */
export function getSiteMeta() {
  const config = getBlogConfig()
  return {
    name: config.site?.name ?? '@Zeithrold/Blog',
    description: config.site?.description ?? 'Ahead Every Moment - @Zeithrold/Blog',
    url: config.site?.url,
  }
}
