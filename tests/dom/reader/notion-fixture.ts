import type { Block, ExtendedRecordMap } from 'notion-types'
import type { PageSnapshot, PublicItem } from '@/contracts/notion'
import { publicItemSchema } from '@/contracts/notion'

export const PAGE_ID = '11111111-1111-4111-8111-111111111111'
export const LINKED_ID = '22222222-2222-4222-8222-222222222222'

export function publicItem(overrides: Partial<PublicItem> = {}): PublicItem {
  return publicItemSchema.parse({
    id: PAGE_ID,
    path: '/posts/first',
    title: 'The public article',
    summary: 'An article summary.',
    publishedAt: Date.UTC(2026, 0, 12),
    updatedAt: Date.UTC(2026, 0, 15),
    tags: [
      { id: 'tag-blue', label: 'Systems', color: 'blue' },
    ],
    cover: { url: 'https://media.example/cover.jpg?signature=one', expiresAt: null },
    ...overrides,
  })
}

const base = {
  parent_id: PAGE_ID,
  parent_table: 'block',
  version: 1,
  created_time: 1,
  last_edited_time: 1,
  alive: true,
  created_by_table: 'notion_user',
  created_by_id: PAGE_ID,
  last_edited_by_table: 'notion_user',
  last_edited_by_id: PAGE_ID,
} as const
const blocks: Block[] = [
  {
    ...base,
    id: PAGE_ID,
    type: 'page',
    parent_table: 'space',
    properties: { title: [
      ['Notion title should stay hidden'],
    ] },
    format: {},
    permissions: [],
    content: [
      'text',
      'heading',
      'links',
      'code',
      'equation',
    ],
  },
  { ...base, id: 'text', type: 'text', properties: { title: [
    [
      'Real rich text',
      [
        ['b'],
      ],
    ],
  ] } },
  { ...base, id: 'heading', type: 'header', properties: { title: [
    ['A body heading'],
  ] } },
  {
    ...base,
    id: 'links',
    type: 'text',
    properties: {
      title: [
        [
          'Relative page',
          [
            [
              'a',
              `/${LINKED_ID.replaceAll('-', '')}#part-one`,
            ],
          ],
        ],
        [
          'Absolute page',
          [
            [
              'a',
              `https://app.notion.com/p/Linked-${LINKED_ID.replaceAll('-', '')}#part-two`,
            ],
          ],
        ],
        [
          'External site',
          [
            ['a', 'https://example.org/guide#section'],
          ],
        ],
        [
          'Unsafe link',
          [
            ['a', 'javascript:alert(1)'],
          ],
        ],
      ],
    },
  },
  {
    ...base,
    id: 'code',
    type: 'code',
    properties: { caption: [], title: [
      ['const answer = 42'],
    ], language: [
      ['JavaScript'],
    ] },
  },
  { ...base, id: 'equation', type: 'equation', properties: { title: [
    ['E=mc^2'],
  ] } },
]
export function pageFixture(): PageSnapshot {
  const recordMap: ExtendedRecordMap = {
    block: Object.fromEntries(blocks.map(value => [
      value.id,
      { role: 'reader' as const, value },
    ])),
    collection: {},
    collection_view: {},
    notion_user: {},
    collection_query: {},
    signed_urls: {},
  }
  return {
    item: publicItem(),
    recordMap,
    pageLinks: { [LINKED_ID]: '/pages/linked' },
    fetchedAt: 1,
    freshUntil: 2,
    mediaExpiresAt: null,
  }
}
