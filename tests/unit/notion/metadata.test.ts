import assert, { deepEqual, equal } from 'node:assert/strict'
import { test } from 'node:test'
import { nextCursor, pagination } from '@/server/notion/api'
import { parseMetadata } from '@/server/notion/metadata'
import { metadata, pageId, rich, source } from './fixtures'

test('published native metadata preserves paths, native tags and future publication dates', () => {
  for (const [slug, expected] of [
    ['bare', '/posts/bare'],
    ['/pages/about', '/pages/about'],
    ['/posts/old', '/posts/old'],
  ] as const) {
    const page = metadata()
    page.properties.Slug.rich_text = [
      rich(slug),
    ]
    const result = parseMetadata(page, source)
    assert.ok(result !== null)
    equal(result.path, expected)
    equal(result.title, 'Actual title')
    deepEqual(result.tags, [
      { id: 'tag-native', label: 'Science', color: 'blue' },
    ] as const)
    equal(result.publishedAt, 4070908800000)
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('draft, archived, trashed and indirectly owned pages are ineligible', () => {
  const draft = metadata()
  draft.properties.Status.status.name = 'Draft'
  const trash = metadata()
  trash.in_trash = true
  const archived = metadata()
  archived.is_archived = true
  const moved = metadata()
  moved.parent.type = 'page_id'
  const other = metadata()
  other.parent.data_source_id = pageId
  for (const page of [
    draft,
    archived,
    trash,
    moved,
    other,
  ]) {
    equal(parseMetadata(page, source), null)
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('published malformed metadata fails instead of disappearing', () => {
  const malformedSlug = metadata()
  malformedSlug.properties.Slug.rich_text = [
    rich('/posts/not/valid'),
  ]
  const badDate = metadata()
  badDate.properties.PublishedAt.date.start = 'not-a-date'
  const badTitle = metadata()
  badTitle.properties.Title.title = []
  for (const page of [
    malformedSlug,
    badDate,
    badTitle,
    { object: 'page', id: pageId },
  ]) {
    assert.throws(() => parseMetadata(page, source))
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('pagination rejects missing, contradictory and repeated cursors', () => {
  equal(pagination({ object: 'list', results: [1], has_more: true, next_cursor: 'next' }).next_cursor, 'next')
  for (const value of [
    { object: 'list', results: [], has_more: true, next_cursor: null },
    { object: 'list', results: [], has_more: false, next_cursor: 'next' },
    { results: [], has_more: false },
    {
      object: 'list',
      results: [],
      has_more: false,
      next_cursor: null,
      request_status: { type: 'incomplete', incomplete_reason: 'query_result_limit_reached' },
    },
  ]) {
    assert.throws(() => pagination(value))
  }
  const seen = new Set<string>()
  nextCursor('next', seen)
  assert.throws(() => nextCursor('next', seen), /Repeated/)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
