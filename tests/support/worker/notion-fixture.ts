import type { Request } from 'miniflare'
import { Response } from 'miniflare'
import {
  aboutId,
  articleBlocks,
  articleId,
  block,
  page,
  rich,
  secondId,
  sourceId,
  tableId,
  toggleId,
} from './notion-wire'

export { articleId, sourceId } from './notion-wire'

export type MarkdownFixtureMode = 'complete' | 'truncated' | 'unknown' | 'malformed'

function list(results: readonly unknown[], cursor: string | null = null) {
  return { object: 'list', results, has_more: cursor !== null, next_cursor: cursor }
}

/** Official REST wire data only; the Worker owns filtering, adaptation and caching. */
export class NotionFixture {
  private readonly article = page(articleId, 'Reliable systems & small tools', 'reliable-systems')
  private readonly second = page(secondId, 'A second field note', 'second-note')
  private readonly about = page(aboutId, 'About this notebook', '/pages/about')
  private readonly draft = page(
    '55555555-5555-4555-8555-555555555555',
    'Unreleased secret notebook',
    'unreleased-secret',
  )

  private paragraph = 'A real Notion paragraph crosses the REST adapter.'
  private readonly additional: ReturnType<typeof page>[] = []

  constructor(
    private readonly markdownMode: MarkdownFixtureMode = 'complete',
    additionalPostCount = 0,
    tagId = 'systems',
    invalidPostSlug = false,
  ) {
    this.draft.properties.Status = { type: 'status', status: { name: 'Draft' } }
    if (invalidPostSlug) {
      this.second.properties.Slug = { type: 'rich_text', rich_text: [
        rich('/post/second-note'),
      ] }
    }
    for (let index = 0; index < additionalPostCount; index++) {
      this.additional.push(page(
        `99999999-9999-4999-8999-${String(index).padStart(12, '0')}`,
        `Additional post ${index}`,
        `extra-post-${index}`,
      ))
    }
    for (const item of [
      this.article,
      this.second,
      this.about,
      this.draft,
      ...this.additional,
    ]) {
      item.properties.Tag = {
        type: 'multi_select',
        multi_select: [
          { id: tagId, name: 'Systems', color: 'blue' },
        ],
      }
    }
  }

  unpublish(): void {
    this.article.properties.Status = { type: 'status', status: { name: 'Draft' } }
  }

  revise(): void {
    this.article.properties.Title = { type: 'title', title: [
      rich('Revised reliable systems'),
    ] }
    // Timestamp stays unchanged so only cache invalidation refreshes the body.
    this.paragraph = 'The revised body arrived after a signed webhook.'
  }

  private async catalog(request: Request): Promise<Response> {
    const body: unknown = await request.json()
    const cursor = typeof body === 'object' && body !== null && 'start_cursor' in body ? body.start_cursor : undefined
    if (cursor === undefined) {
      return Response.json(list([
        this.article,
        this.draft,
      ], 'catalog-next'))
    }
    if (cursor === 'catalog-next') {
      return Response.json(list([
        this.second,
        this.about,
        ...this.additional,
      ]))
    }
    throw new Error('Unexpected catalog pagination cursor')
  }

  private blocks(url: URL): Response {
    const id = /^\/v1\/blocks\/([^/]+)\/children$/.exec(url.pathname)?.[1]
    if (id === articleId) {
      const blocks = articleBlocks(this.paragraph)
      return url.searchParams.get('start_cursor') === null
        ? Response.json(list(blocks.slice(0, 4), 'blocks-next'))
        : Response.json(list(blocks.slice(4)))
    }
    const nested = new Map([
      [
        toggleId,
        [
          block(10, 'paragraph', { rich_text: [
            rich('Nested recovery instructions.'),
          ] }),
        ],
      ],
      [
        tableId,
        [
          block(11, 'table_row', { cells: [
            [
              rich('Signal'),
            ],
            [
              rich('Action'),
            ],
          ] }),
          block(12, 'table_row', { cells: [
            [
              rich('Failure'),
            ],
            [
              rich('Recover'),
            ],
          ] }),
        ],
      ],
    ])
    if (id === aboutId || id === secondId || this.additional.some(value => value.id === id)) {
      return Response.json(list([
        block(13, 'paragraph', { rich_text: [
          rich('This notebook is served from Notion.'),
        ] }),
      ]))
    }
    const children = id === undefined ? undefined : nested.get(id)
    if (children === undefined) {
      throw new Error(`Unhandled block children: ${url.pathname}`)
    }
    return Response.json(list(children))
  }

  private retrievePage(url: URL): Response {
    if (url.pathname === `/v1/pages/${articleId}/markdown`) {
      return Response.json({
        object: 'page_markdown',
        id: articleId,
        markdown: this.markdownMode === 'malformed'
          ? null
          : `## Designing for recovery\n\n${this.paragraph} **Strong evidence.**\n\n`
            + '- Keep the recovery path observable.\n\n```javascript\nconst recovery = true;\n```\n',
        truncated: this.markdownMode === 'truncated',
        unknown_block_ids: this.markdownMode === 'unknown' ? [toggleId] : [],
      })
    }
    const id = url.pathname.slice('/v1/pages/'.length)
    const pages = [
      this.article,
      this.second,
      this.about,
      this.draft,
      ...this.additional,
    ]
    const found = pages.find(value => value.id === id)
    if (found === undefined) {
      throw new Error(`Unhandled page retrieval: ${id}`)
    }
    return Response.json(found)
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.origin !== 'https://api.notion.com'
      || request.headers.get('authorization') !== 'Bearer fixture-notion-token'
      || request.headers.get('notion-version') !== '2026-03-11') {
      throw new Error(`Unexpected outbound request: ${request.method} ${url.origin}${url.pathname}`)
    }
    if (request.method === 'POST' && url.pathname === `/v1/data_sources/${sourceId}/query`) {
      return await this.catalog(request)
    }
    if (request.method === 'GET' && url.pathname.startsWith('/v1/pages/')) {
      return this.retrievePage(url)
    }
    if (request.method === 'GET' && url.pathname.startsWith('/v1/blocks/')) {
      return this.blocks(url)
    }
    throw new Error(`Unhandled Notion fixture request: ${request.method} ${url.pathname}${url.search}`)
  }
}
