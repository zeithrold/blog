import type { ExtendedRecordMap } from 'notion-types'
import { z } from 'zod'

z.config({ jitless: true })

export const slugSchema = z.string().min(1).max(120).regex(/^[a-z0-9][a-z0-9-]{0,119}$/)
export const publicPathSchema = z
  .string()
  .regex(/^\/(?:posts|pages)\/[a-z0-9][a-z0-9-]{0,119}$/)
  .transform(value => value.startsWith('/pages/')
    ? `/pages/${value.slice(7)}` as const
    : `/posts/${value.slice(7)}` as const)

export type PublicPath = z.infer<typeof publicPathSchema>

export function parsePublicPath(value: string): PublicPath {
  return publicPathSchema.parse(value.startsWith('/') ? value : `/posts/${value}`)
}

export const publicTagSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  color: z.enum([
    'default',
    'gray',
    'brown',
    'orange',
    'yellow',
    'green',
    'blue',
    'purple',
    'pink',
    'red',
  ]),
}).readonly()

export const publicItemSchema = z.object({
  id: z.uuid(),
  path: publicPathSchema,
  title: z.string().min(1),
  summary: z.string(),
  publishedAt: z.number(),
  updatedAt: z.number(),
  tags: z.array(publicTagSchema).readonly(),
  cover: z.object({
    url: z.url({ protocol: /^https$/ }),
    expiresAt: z.number().nullable(),
  }).readonly().nullable(),
}).readonly()

export type PublicTag = z.infer<typeof publicTagSchema>
export type PublicItem = z.infer<typeof publicItemSchema>

export const tagDescriptionSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().min(1),
}).readonly()
export type TagDescription = z.infer<typeof tagDescriptionSchema>

export function tagUrl(id: PublicTag['id']): string {
  return `/tags/${encodeURIComponent(id)}`
}

export type CatalogSnapshot = {
  readonly items: readonly PublicItem[]
  readonly tagDescriptions: readonly TagDescription[]
  readonly fetchedAt: number
  readonly freshUntil: number
}

export type PageSnapshot = {
  readonly item: PublicItem
  readonly recordMap: ExtendedRecordMap
  readonly pageLinks: Readonly<Record<string, PublicPath>>
  readonly fetchedAt: number
  readonly freshUntil: number
  readonly mediaExpiresAt: number | null
}
