import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { workerFixture } from '../support/worker/runtime'

function rejected(error: unknown): never {
  throw error instanceof Error ? error : new Error('Test registration failed', { cause: error })
}

for (const [path, canonical, title] of [
  [
    '/',
    '/',
    'Software, systems, and field notes',
  ],
  [
    '/?offset=0&utm_source=test',
    '/',
    'Software, systems, and field notes',
  ],
  [
    '/tags',
    '/tags',
    'Tags',
  ],
  [
    '/tags/systems?offset=0&utm_source=test',
    '/tags/systems',
    'Systems articles',
  ],
] as const) {
  test(`listing metadata identifies ${path} with its normalized canonical`, async () => {
    await using worker = await workerFixture()
    const response = await worker.fetch(path)
    assert.equal(response.status, 200)
    const document = new JSDOM(await response.text()).window.document
    assert.ok(document.title === `${title} · zeithrold/blog`)
    assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute('href'), worker.origin + canonical)
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content')
    assert.ok(description !== undefined && description !== null && description.length > 0)
    assert.notEqual(description, 'Notes on building things.')
    assert.equal(document.querySelector('meta[property="og:url"]')?.getAttribute('content'), worker.origin + canonical)
    assert.equal(document.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex'), false)
  }).catch(rejected)
}

test('home pagination retains its own canonical and only the remaining article', async () => {
  await using worker = await workerFixture({ additionalPostCount: 49 })
  const response = await worker.fetch('/?offset=50&utm_source=test')
  assert.equal(response.status, 200)
  const document = new JSDOM(await response.text()).window.document
  assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute('href'), `${worker.origin}/?offset=50`)
  assert.match(document.title, /51/)
  assert.equal(document.querySelectorAll('#posts ol a[aria-labelledby^="feed-post-"]').length, 1)
}).catch(rejected)

for (const query of [
  '',
  '?q=reliable',
  '?q=does-not-exist',
]) {
  test(`search ${query} stays usable but is excluded from indexing`, async () => {
    await using worker = await workerFixture()
    const response = await worker.fetch(`/search${query}`)
    assert.equal(response.status, 200)
    const document = new JSDOM(await response.text()).window.document
    const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? ''
    assert.match(robots, /\bnoindex\b/)
    assert.match(robots, /\bfollow\b/)
    assert.equal(document.querySelector('form')?.getAttribute('action'), '/search')
  }).catch(rejected)
}

for (const path of [
  '/?offset=2',
  '/?offset=100000',
  '/?offset=0&offset=50',
  '/?offset=00',
  '/tags/systems?offset=2',
  '/search?q=reliable&offset=1',
  '/search?q=does-not-exist&offset=1',
]) {
  test(`out-of-range or ambiguous listing ${path} is a real 404`, async () => {
    await using worker = await workerFixture()
    assert.equal((await worker.fetch(path)).status, 404)
  }).catch(rejected)
}

test('an empty first home page is still a real page', async () => {
  await using worker = await workerFixture({ invalidPostSlug: true })
  worker.unpublish()
  const response = await worker.fetch('/')
  assert.equal(response.status, 200)
  const document = new JSDOM(await response.text()).window.document
  assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute('href'), `${worker.origin}/`)
  assert.equal(document.querySelectorAll('#posts ol a').length, 0)
}).catch(rejected)
