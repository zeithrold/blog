import type { Client } from '@notionhq/client'
import type { PublicItem, TagDescription } from '@/contracts/notion'
import { z } from 'zod'
import { canonicalId, NotionContentError } from './api'

const dataSourceSchema = z.object({
  object: z.literal('data_source'),
  id: z.uuid(),
  properties: z.object({
    Tag: z.object({
      type: z.literal('multi_select'),
      multi_select: z.object({
        options: z.array(z.object({ id: z.string().min(1), description: z.string().trim().nullable() })),
      }),
    }),
  }),
})

export async function readTagDescriptions(
  client: Client,
  source: string,
  items: readonly PublicItem[],
): Promise<readonly TagDescription[]> {
  const posts = items.filter(item => item.path.startsWith('/posts/'))
  const ids = new Set(posts.flatMap(item => item.tags.map(tag => tag.id)))
  if (ids.size === 0) {
    return []
  }
  const dataSource = dataSourceSchema.parse(await client.dataSources.retrieve({ data_source_id: source }))
  if (canonicalId(dataSource.id) !== canonicalId(source)) {
    throw new NotionContentError('Unexpected tag data source')
  }
  return dataSource.properties.Tag.multi_select.options.flatMap(option =>
    ids.has(option.id) && option.description !== null && option.description.length > 0
      ? [
          { id: option.id, description: option.description },
        ]
      : [])
}
