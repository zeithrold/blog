import assert, { deepEqual, equal } from 'node:assert/strict'
import { test } from 'node:test'
import { cacheKey } from '@/server/notion/cache'
import { readCatalog } from '@/server/notion/catalog'
import { readPage } from '@/server/notion/page'
import { blockValue, dataSource, fixture, metadata, pageId, rich, source, stored } from './fixtures'

function list(results: unknown[], next: string | null = null) {
  return { object: 'list', results, has_more: next !== null, next_cursor: next }
}

test('an invalid published slug is excluded without blocking valid catalog entries', async (t) => {
  const bindings = await fixture(t)
  const invalid = metadata()
  invalid.id = '33333333-3333-4333-8333-333333333333'
  invalid.properties.Slug.rich_text = [
    rich('/post/invalid'),
  ]
  const errors = t.mock.method(console, 'error', () => {})
  const responses = [
    list([
      invalid,
      metadata(),
    ]),
    dataSource(),
  ]
  t.mock.method(globalThis, 'fetch', async () => await Promise.resolve(Response.json(responses.shift())))
  const result = await readCatalog(bindings)
  deepEqual(result.items.map(item => item.path), ['/posts/original'])
  equal(errors.mock.callCount(), 1)
  const diagnostic = JSON.stringify(errors.mock.calls[0]?.arguments)
  assert.match(diagnostic, /33333333-3333-4333-8333-333333333333/)
  assert.match(diagnostic, /invalid_format/)
  assert.doesNotMatch(diagnostic, /Actual title|\/post\/invalid/)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('catalog follows query pagination and rejects duplicate eligible paths', async (t) => {
  const bindings = await fixture(t)
  const other = metadata()
  other.id = '33333333-3333-4333-8333-333333333333'
  other.properties.Slug.rich_text = [
    rich('/pages/second'),
  ]
  const responses = [
    list([
      metadata(),
    ], 'next'),
    list([other]),
    dataSource(),
  ]
  t.mock.method(globalThis, 'fetch', async () => await Promise.resolve(Response.json(responses.shift())))
  const result = await readCatalog(bindings)
  deepEqual(result.items.map(item => item.path), ['/pages/second', '/posts/original'])
  equal(responses.length, 0)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('duplicate published URLs and partial query pages fail without caching', async (t) => {
  const bindings = await fixture(t)
  const other = { ...metadata(), id: '33333333-3333-4333-8333-333333333333' }
  const responses = [
    list([
      metadata(),
      other,
    ]),
    list([
      { object: 'page', id: pageId },
    ]),
  ]
  t.mock.method(globalThis, 'fetch', async () => await Promise.resolve(Response.json(responses.shift())))
  await assert.rejects(readCatalog(bindings), /Duplicate public path/)
  await assert.rejects(readCatalog(bindings))
  equal(await bindings.NOTION_CACHE.get(cacheKey(bindings, 'catalog')), null)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('page body cache never bypasses current Draft, renamed or moved metadata', async (t) => {
  const bindings = await fixture(t)
  const draft = metadata()
  draft.properties.Status.status.name = 'Draft'
  const renamed = metadata()
  renamed.properties.Slug.rich_text = [
    rich('new-name'),
  ]
  const moved = metadata()
  moved.parent.type = 'page_id'
  const invalid = metadata()
  invalid.properties.Slug.rich_text = [
    rich('/post/invalid'),
  ]
  const responses = [
    metadata(),
    list([
      stored('text', 'paragraph', { rich_text: [
        rich('Body'),
      ] }).block,
    ]),
    draft,
    renamed,
    moved,
    invalid,
  ]
  const now = Date.now()
  await bindings.NOTION_CACHE.put(cacheKey(bindings, 'catalog'), JSON.stringify({
    tagDescriptions: [],
    items: [
      {
        id: pageId,
        path: '/posts/original',
        title: 'Catalog',
        summary: '',
        publishedAt: 1,
        updatedAt: 1,
        tags: [],
        cover: null,
      },
    ],
    fetchedAt: now,
    freshUntil: now + 60_000,
  }))
  t.mock.method(globalThis, 'fetch', async () => {
    if (responses.length === 0) {
      throw new Error('Unexpected body fetch')
    }
    return await Promise.resolve(Response.json(responses.shift()))
  })
  const firstPage = await readPage(bindings, '/posts/original')
  assert.ok(firstPage !== null)
  equal(blockValue(firstPage.recordMap, 'text')?.type, 'text')
  for (let index = 0; index < 4; index++) {
    equal(await readPage(bindings, '/posts/original'), null)
  }
  equal(responses.length, 0)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('page traverses every nested child page in order', async (t) => {
  const bindings = await fixture(t)
  const parent = stored('toggle', 'toggle', { rich_text: [
    rich('Toggle'),
  ] }, { parentId: pageId, children: ['child'] })
  const first = stored('child', 'paragraph', { rich_text: [
    rich('First'),
  ] }, { parentId: 'toggle' })
  const second = stored('second', 'paragraph', { rich_text: [
    rich('Second'),
  ] }, { parentId: 'toggle' })
  const responses = [
    list([
      metadata(),
    ]),
    dataSource(),
    metadata(),
    list([parent.block]),
    list([first.block], 'next'),
    list([second.block]),
  ]
  t.mock.method(globalThis, 'fetch', async () => await Promise.resolve(Response.json(responses.shift())))
  const page = await readPage(bindings, '/posts/original')
  assert.ok(page !== null)
  deepEqual(blockValue(page.recordMap, 'toggle')?.content, ['child', 'second'])
  deepEqual(blockValue(page.recordMap, pageId)?.content, ['toggle'])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a failed nested child request never caches a partially read body', async (t) => {
  const bindings = await fixture(t)
  const parent = stored('toggle', 'toggle', { rich_text: [
    rich('Toggle'),
  ] }, { parentId: pageId, children: ['child'] })
  const failed = [
    list([
      metadata(),
    ]),
    dataSource(),
    metadata(),
    list([parent.block]),
  ]
  t.mock.method(globalThis, 'fetch', async () => {
    if (failed.length > 0) {
      return await Promise.resolve(Response.json(failed.shift()))
    }
    return await Promise.resolve(Response.json({
      object: 'error',
      code: 'validation_error',
      message: 'Child failure',
    }, { status: 400 }))
  })
  await assert.rejects(readPage(bindings, '/posts/original'), /Child failure/)
  equal(await bindings.NOTION_CACHE.get(cacheKey(bindings, `page:${pageId}`)), null)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('schema read failures do not cache a catalog without its tag descriptions', async (t) => {
  const bindings = await fixture(t)
  const responses = [
    Response.json(list([
      metadata(),
    ])),
    Response.json({ object: 'error', code: 'restricted_resource', message: 'Schema denied' }, { status: 403 }),
  ]
  t.mock.method(globalThis, 'fetch', async () =>
    await Promise.resolve(responses.shift() ?? assert.fail('Unexpected read')))
  await assert.rejects(readCatalog(bindings), /Schema denied/)
  equal(await bindings.NOTION_CACHE.get(cacheKey(bindings, 'catalog')), null)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('old catalog envelopes cannot hide schema descriptions after the cache contract changes', async (t) => {
  const bindings = await fixture(t)
  await bindings.NOTION_CACHE.put(`notion:v1:${source}:catalog`, JSON.stringify({
    items: [],
    fetchedAt: Date.now(),
    freshUntil: Date.now() + 60_000,
  }))
  const schema = dataSource()
  const option = schema.properties.Tag.multi_select.options[0]
  assert.ok(option !== undefined)
  const described = { ...schema, properties: { Tag: { ...schema.properties.Tag, multi_select: { options: [
    { ...option, description: 'Native schema introduction.' },
  ] } } } }
  const responses = [
    list([
      metadata(),
    ]),
    described,
  ]
  t.mock.method(globalThis, 'fetch', async () => await Promise.resolve(Response.json(responses.shift())))
  const catalog = await readCatalog(bindings)
  deepEqual(catalog.tagDescriptions, [
    { id: 'tag-native', description: 'Native schema introduction.' },
  ])
  equal(catalog.items.length, 1)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
