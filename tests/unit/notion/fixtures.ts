import type { TestContext } from 'node:test'
import type { Block, ExtendedRecordMap } from 'notion-types'
import type { PublicItem } from '@/contracts/notion'
import type { RichText } from '@/server/notion/api'
import type { NotionBindings } from '@/server/notion/bindings'
import type { StoredBlock } from '@/server/notion/blocks'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'
import { blockSchema } from '@/server/notion/blocks'
import { parseMetadata } from '@/server/notion/metadata'

export const source = '11111111-1111-4111-8111-111111111111'
export const pageId = '22222222-2222-4222-8222-222222222222'
export const timestamp = '2026-01-02T03:04:05.000Z'

export function rich(content: string): RichText {
  return {
    type: 'text',
    plain_text: content,
    href: null,
    text: { content, link: null },
    annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' },
  }
}

export function metadata(): {
  object: string
  id: string
  parent: { type: string, data_source_id: string }
  is_archived: boolean
  in_trash: boolean
  created_time: string
  last_edited_time: string
  cover: null
  properties: {
    Title: { type: string, title: ReturnType<typeof rich>[] }
    Slug: { type: string, rich_text: ReturnType<typeof rich>[] }
    Summary: { type: string, rich_text: ReturnType<typeof rich>[] }
    PublishedAt: { type: string, date: { start: string } }
    Status: { type: string, status: { name: string } }
    Tag: { type: string, multi_select: { id: string, name: string, color: string }[] }
  }
} {
  return {
    object: 'page',
    id: pageId,
    parent: { type: 'data_source_id', data_source_id: source },
    is_archived: false,
    in_trash: false,
    created_time: timestamp,
    last_edited_time: timestamp,
    cover: null,
    properties: {
      Title: { type: 'title', title: [
        rich('Actual title'),
      ] },
      Slug: { type: 'rich_text', rich_text: [
        rich('original'),
      ] },
      Summary: { type: 'rich_text', rich_text: [
        rich('Summary'),
      ] },
      PublishedAt: { type: 'date', date: { start: '2099-01-01' } },
      Status: { type: 'status', status: { name: 'Published' } },
      Tag: { type: 'multi_select', multi_select: [
        { id: 'tag-native', name: 'Science', color: 'blue' },
      ] },
    },
  }
}

export function item(): PublicItem {
  const parsed = parseMetadata(metadata(), source)
  if (parsed === null) {
    throw new Error('Expected eligible fixture')
  }
  return parsed
}

export function stored(
  id: string,
  type: string,
  data: unknown,
  options: { readonly parentId?: string, readonly children?: string[] } = {},
): StoredBlock {
  const parentId = options.parentId ?? pageId
  const children = options.children ?? []
  return {
    block: blockSchema.parse({
      object: 'block',
      id,
      type,
      has_children: children.length > 0,
      in_trash: false,
      created_time: timestamp,
      last_edited_time: timestamp,
      [type]: data,
    }),
    parentId,
    children,
  }
}

export async function fixture(t: TestContext): Promise<NotionBindings> {
  const root = await mkdtemp(join(tmpdir(), 'notion-unit-'))
  const runtime = new Miniflare(convertV4MiniflareOptions({
    cf: false,
    modules: true,
    script: 'export default { fetch() { return new Response(null, {status: 204}) } }',
    compatibilityDate: '2026-03-11',
    kvNamespaces: ['CACHE'],
    kvPersist: root,
  }))
  t.after(async () => {
    try {
      await runtime.dispose()
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
  return {
    NOTION_API_KEY: 'unit-token',
    NOTION_DATA_SOURCE_ID: source,
    NOTION_CACHE: (await runtime.getBindings<{ CACHE: NotionBindings['NOTION_CACHE'] }>()).CACHE,
    NOTION_WEBHOOK_SECRET: 'unit-webhook-secret',
  }
}

export function blockValue(map: ExtendedRecordMap, id: string): Block | undefined {
  const value = map.block[id]?.value
  return (value !== undefined) && 'type' in value ? value : value?.value
}
