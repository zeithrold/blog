import type { PublicItem } from '@/contracts/notion'
import { z } from 'zod'
import { parsePublicPath, publicItemSchema } from '@/contracts/notion'
import { canonicalId, dateTime, media, mediaSchema, richTextSchema } from './api'

const propertySchema = z.object({ type: z.string(), has_more: z.literal(false).optional() }).loose()
export const metadataSchema = z.object({
  object: z.literal('page'),
  id: z.uuid(),
  parent: z.object({ type: z.string(), data_source_id: z.string().optional() }),
  is_archived: z.boolean(),
  in_trash: z.boolean(),
  created_time: dateTime,
  last_edited_time: dateTime,
  properties: z.record(z.string(), propertySchema),
  cover: mediaSchema.nullable(),
})
export type PageMetadata = z.infer<typeof metadataSchema>
const texts = z.array(richTextSchema)

export function readMetadata(value: unknown, source: string): PublicItem | null {
  try {
    return parseMetadata(value, source)
  }
  catch (error) {
    if (!(error instanceof z.ZodError)) {
      throw error
    }
    const page = metadataSchema.safeParse(value)
    if (!page.success) {
      throw error
    }
    console.error('NOTION_METADATA_INVALID', {
      pageId: page.data.id,
      issues: error.issues.map(issue => ({
        path: issue.path,
        code: issue.code,
        message: issue.message,
      })),
    })
    return null
  }
}

export function parseMetadata(value: unknown, source: string): PublicItem | null {
  const page = metadataSchema.parse(value)
  if (page.parent.type !== 'data_source_id'
    || (page.parent.data_source_id === undefined)
    || canonicalId(page.parent.data_source_id) !== canonicalId(source)
    || page.is_archived || page.in_trash) {
    return null
  }

  const status = z.object({
    type: z.literal('status'),
    status: z.object({ name: z.string() }).nullable(),
  }).parse(page.properties.Status)
  if (status.status?.name !== 'Published') {
    return null
  }

  const title = z.object({ type: z.literal('title'), title: texts }).parse(page.properties.Title)
  const slug = z.object({ type: z.literal('rich_text'), rich_text: texts }).parse(page.properties.Slug)
  const summary = z.object({ type: z.literal('rich_text'), rich_text: texts }).parse(page.properties.Summary)
  const published = z.object({
    type: z.literal('date'),
    date: z.object({ start: dateTime }),
  }).parse(page.properties.PublishedAt)
  const tags = z.object({
    type: z.literal('multi_select'),
    multi_select: z.array(z.object({ id: z.string(), name: z.string(), color: z.string() })),
  }).parse(page.properties.Tag)
  return publicItemSchema.parse({
    id: page.id,
    title: title.title.map(text => text.plain_text).join(''),
    path: parsePublicPath(slug.rich_text.map(text => text.plain_text).join('')),
    summary: summary.rich_text.map(text => text.plain_text).join(''),
    publishedAt: Date.parse(published.date.start),
    updatedAt: Date.parse(page.last_edited_time),
    tags: tags.multi_select.map(tag => ({ id: tag.id, label: tag.name, color: tag.color })),
    cover: (page.cover !== null) ? media(page.cover) : null,
  })
}
