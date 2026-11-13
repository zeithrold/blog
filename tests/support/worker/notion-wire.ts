import type { RichText } from '@/server/notion/api'
import type { StoredBlock } from '@/server/notion/block-shape'
import type { PageMetadata } from '@/server/notion/metadata'
import { blockSchema } from '@/server/notion/block-shape'
import { metadataSchema } from '@/server/notion/metadata'

export const sourceId = '11111111-1111-4111-8111-111111111111'
export const articleId = '22222222-2222-4222-8222-222222222222'
export const secondId = '33333333-3333-4333-8333-333333333333'
export const aboutId = '44444444-4444-4444-8444-444444444444'
export const toggleId = '66666666-6666-4666-8666-666666666666'
export const tableId = '77777777-7777-4777-8777-777777777777'
const timestamp = '2026-01-02T03:04:05.000Z'

export function rich(content: string, bold = false): RichText {
  return {
    type: 'text',
    plain_text: content,
    href: null,
    text: { content, link: null },
    annotations: { bold, italic: false, strikethrough: false, underline: false, code: false, color: 'default' },
  }
}

export function page(id: string, title: string, slug: string): PageMetadata {
  return metadataSchema.parse({
    object: 'page',
    id,
    parent: { type: 'data_source_id', data_source_id: sourceId },
    is_archived: false,
    in_trash: false,
    created_time: timestamp,
    last_edited_time: timestamp,
    cover: null,
    properties: {
      Title: { type: 'title', title: [
        rich(title),
      ] },
      Slug: { type: 'rich_text', rich_text: [
        rich(slug),
      ] },
      Summary: { type: 'rich_text', rich_text: [
        rich('Field notes on resilient systems & practical design.'),
      ] },
      PublishedAt: { type: 'date', date: { start: '2026-01-02' } },
      Status: { type: 'status', status: { name: 'Published' } },
      Tag: { type: 'multi_select', multi_select: [
        { id: 'systems', name: 'Systems', color: 'blue' },
      ] },
    },
  })
}

export function block(id: string | number, type: string, data: unknown): StoredBlock['block'] {
  return blockSchema.parse({
    object: 'block',
    id: typeof id === 'number' ? `88888888-8888-4888-8888-${String(id).padStart(12, '0')}` : id,
    type,
    has_children: type === 'toggle' || type === 'table',
    in_trash: false,
    created_time: timestamp,
    last_edited_time: timestamp,
    [type]: data,
  })
}

export function articleBlocks(paragraph: string): StoredBlock['block'][] {
  const aboutURL = `https://app.notion.com/p/about-${aboutId.replaceAll('-', '')}`
  return [
    block(1, 'heading_2', { rich_text: [
      rich('Designing for recovery'),
    ] }),
    block(2, 'paragraph', { rich_text: [
      rich(paragraph),
      rich(' Strong evidence.', true),
    ] }),
    block(3, 'bulleted_list_item', { rich_text: [
      rich('Keep the recovery path observable.'),
    ] }),
    block(toggleId, 'toggle', { rich_text: [
      rich('Read the recovery detail'),
    ] }),
    block(4, 'paragraph', {
      rich_text: [
        {
          ...rich('About this notebook'),
          href: aboutURL,
          text: { content: 'About this notebook', link: { url: aboutURL } },
        },
      ],
    }),
    block(tableId, 'table', { table_width: 2, has_column_header: true, has_row_header: false }),
    block(5, 'code', { rich_text: [
      rich('const recovery = true;'),
    ], language: 'javascript', caption: [] }),
    block(6, 'equation', { expression: 'E = mc^2' }),
  ]
}
