import type { NotionBindings } from './bindings'
import { Client } from '@notionhq/client'
import { z } from 'zod'

export class NotionContentError extends Error {
  constructor(readonly reason: string) {
    super(reason)
    this.name = 'NotionContentError'
  }
}

export function notionClient(bindings: NotionBindings): Client {
  return new Client({
    auth: bindings.NOTION_API_KEY,
    notionVersion: '2026-03-11',
    timeoutMs: 15_000,
    retry: false,
  })
}

export const dateTime = z.string().refine(value => Number.isFinite(Date.parse(value)))
export const richTextSchema = z.object({
  type: z.enum([
    'text',
    'mention',
    'equation',
  ]),
  plain_text: z.string(),
  href: z.string().nullable(),
  annotations: z.object({
    bold: z.boolean(),
    italic: z.boolean(),
    strikethrough: z.boolean(),
    underline: z.boolean(),
    code: z.boolean(),
    color: z.string(),
  }),
  text: z.object({ content: z.string(), link: z.object({ url: z.string() }).nullable() }).optional(),
  mention: z.object({
    type: z.string(),
    page: z.object({ id: z.string() }).optional(),
  }).optional(),
  equation: z.object({ expression: z.string() }).optional(),
})
export type RichText = z.infer<typeof richTextSchema>

export const mediaSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('external'), external: z.object({ url: z.url({ protocol: /^https$/ }) }) }),
  z.object({ type: z.literal('file'), file: z.object({ url: z.url({ protocol: /^https$/ }), expiry_time: dateTime }) }),
])

export function media(value: z.infer<typeof mediaSchema>): { readonly url: string, readonly expiresAt: number | null } {
  switch (value.type) {
    case 'external': return { url: value.external.url, expiresAt: null }
    case 'file': return { url: value.file.url, expiresAt: Date.parse(value.file.expiry_time) }
  }
}

export function pagination(value: unknown): {
  readonly object: 'list'
  readonly results: unknown[]
  readonly has_more: boolean
  readonly next_cursor: string | null
} {
  const result = z.object({
    object: z.literal('list'),
    results: z.array(z.unknown()),
    has_more: z.boolean(),
    next_cursor: z.string().min(1).nullable(),
    request_status: z.object({ type: z.enum(['complete', 'incomplete']) }).optional(),
  }).parse(value)
  if (result.has_more !== (result.next_cursor !== null) || result.request_status?.type === 'incomplete') {
    throw new NotionContentError('Incomplete pagination response')
  }
  return result
}

export function nextCursor(cursor: string | null, seen: Set<string>): string | null {
  if (cursor !== null) {
    if (seen.has(cursor)) {
      throw new NotionContentError('Repeated pagination cursor')
    }
    seen.add(cursor)
  }
  return cursor
}

export function canonicalId(value: string): string {
  return value.replaceAll('-', '').toLowerCase()
}
