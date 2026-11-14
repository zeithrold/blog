import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { articleId } from '../support/worker/notion-fixture'
import { subscriptionId, webhookSecret, workerFixture } from '../support/worker/runtime'

function html(body: string) {
  return new JSDOM(body).window.document
}

function rejected(error: unknown): never {
  if (error instanceof Error) {
    throw error
  }
  throw new Error('Native test registration failed', { cause: error })
}

test('invalid published metadata cannot take down public readers or expose the invalid article', async () => {
  await using worker = await workerFixture({ invalidPostSlug: true })
  const response = await worker.fetch('/')
  assert.equal(response.status, 200)
  const document = html(await response.text())
  assert.deepEqual(
    Array.from(document.querySelectorAll('#posts ol a[aria-labelledby^="feed-post-"]'))
      .map(link => link.getAttribute('href')),
    ['/posts/reliable-systems'],
  )
  const tags = await worker.fetch('/tags/systems')
  assert.equal(tags.status, 200)
  assert.match(html(await tags.text()).querySelector('main header')?.textContent ?? '', /1 post/)
  const article = await worker.fetch('/posts/reliable-systems')
  assert.equal(article.status, 200)
  assert.match(html(await article.text()).querySelector('.notion')?.textContent ?? '', /A real Notion paragraph/)
  const markdown = await worker.fetch('/posts/reliable-systems.md')
  assert.equal(markdown.status, 200)
  assert.match(await markdown.text(), /A real Notion paragraph/)
  assert.equal((await worker.fetch('/posts/second-note')).status, 404)
  assert.equal((await worker.fetch('/posts/second-note.md')).status, 404)
}).catch(rejected)

test('home lists published posts from every Notion query page', async () => {
  await using worker = await workerFixture()
  const response = await worker.fetch('/')
  assert.equal(response.status, 200)
  const document = html(await response.text())
  assert.deepEqual(
    Array.from(document.querySelectorAll('#posts ol a[aria-labelledby^="feed-post-"]'))
      .map(link => link.getAttribute('href')),
    ['/posts/reliable-systems', '/posts/second-note'],
  )
  assert.equal(document.querySelector('#posts h3')?.textContent, 'Reliable systems & small tools')
  assert.equal(document.querySelectorAll('#posts .post-feed-tags').length, 2)
}).catch(rejected)

test('article renders adapted nested Notion blocks and mapped public links', async () => {
  await using worker = await workerFixture()
  const response = await worker.fetch('/posts/reliable-systems')
  assert.equal(response.status, 200)
  const document = html(await response.text())
  const body = document.querySelector('.notion')
  assert.ok(body !== null, 'The real NotionRenderer must render its body')
  assert.equal(body.querySelector('h1,h2,h3,h4,h5,h6')?.textContent, 'Designing for recovery')
  assert.match(body.textContent, /Nested recovery instructions\./)
  assert.equal(body.querySelector('b')?.textContent, ' Strong evidence.')
  assert.equal(body.querySelector('a[href="/pages/about"]')?.textContent, 'About this notebook')
  const rows = Array.from(body.querySelectorAll('table tr')).map(row => row.textContent)
  assert.equal(rows.join('\n'), 'SignalAction\nFailureRecover')
  assert.match(body.querySelector('pre')?.textContent ?? '', /const recovery = true;/)
  assert.ok(body.querySelector('.notion-equation') !== null, 'The equation must reach the renderer')
}).catch(rejected)

for (const [query, paths] of [
  [
    'second',
    ['/posts/second-note'],
  ],
  [
    'about',
    ['/pages/about'],
  ],
  [
    'SYSTEMS',
    [
      '/pages/about',
      '/posts/reliable-systems',
      '/posts/second-note',
    ],
  ],
  [
    'unreleased secret',
    [],
  ],
] as const) {
  test(`search filters published metadata for ${JSON.stringify(query)}`, async () => {
    await using worker = await workerFixture()
    const response = await worker.fetch(`/search?q=${encodeURIComponent(query)}`)
    assert.equal(response.status, 200)
    const document = html(await response.text())
    assert.deepEqual(
      Array.from(document.querySelectorAll('.post-list a')).map(link => link.getAttribute('href')),
      paths,
    )
  }).catch(rejected)
}

test('static public pages render their Notion content', async () => {
  await using worker = await workerFixture()
  const response = await worker.fetch('/pages/about')
  assert.equal(response.status, 200)
  const document = html(await response.text())
  assert.equal(document.querySelector('h1')?.textContent, 'About this notebook')
  assert.match(document.querySelector('.notion')?.textContent ?? '', /This notebook is served from Notion\./)
}).catch(rejected)

for (const path of [
  '/posts/unreleased-secret',
  '/posts/absent',
  '/pages/absent',
  '/missing-route',
]) {
  test(`public route ${path} returns a real 404`, async () => {
    await using worker = await workerFixture()
    const response = await worker.fetch(path)
    assert.equal(response.status, 404)
    const document = html(await response.text())
    assert.equal(document.querySelector('h1')?.textContent, 'Not found')
    assert.equal(document.querySelector('a[href="/"]')?.getAttribute('href'), '/')
    assert.doesNotMatch(document.querySelector('main')?.textContent ?? '', /Unreleased secret notebook/)
  }).catch(rejected)
}

test('RSS exposes only published posts with escaped metadata and absolute URLs', async () => {
  await using worker = await workerFixture()
  const response = await worker.fetch('/rss.xml')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /^application\/rss\+xml/)
  const xml = new JSDOM(await response.text(), { contentType: 'text/xml' }).window.document
  const links = Array.from(xml.querySelectorAll('item link')).map(link => link.textContent)
  assert.equal(
    links.join('\n'),
    'https://fixture.example/posts/reliable-systems\nhttps://fixture.example/posts/second-note',
  )
  assert.equal(xml.querySelector('item title')?.textContent, 'Reliable systems & small tools')
  assert.equal(
    xml.querySelector('item description')?.textContent,
    'Field notes on resilient systems & practical design.',
  )
}).catch(rejected)

test('sitemap includes published posts and pages but excludes drafts', async () => {
  await using worker = await workerFixture()
  const response = await worker.fetch('/sitemap.xml')
  assert.equal(response.status, 200)
  const xml = new JSDOM(await response.text(), { contentType: 'text/xml' }).window.document
  const locations = Array.from(xml.querySelectorAll('loc')).map(link => link.textContent)
  assert.deepEqual(
    locations,
    [
      'https://fixture.example',
      'https://fixture.example/pages/about',
      'https://fixture.example/posts/reliable-systems',
      'https://fixture.example/posts/second-note',
    ] as const,
  )
  assert.equal(xml.querySelector('lastmod')?.textContent, '2026-01-02T03:04:05.000Z')
}).catch(rejected)

for (const scenario of [
  { authorization: 'signed', status: 204 },
  { authorization: 'unsigned', status: 401 },
  { authorization: 'tampered', status: 401 },
  { authorization: 'other-subscription', status: 403 },
] as const) {
  const { authorization, status } = scenario
  test(`${authorization} webhook returns ${status} and maintains the cache boundary`, async () => {
    await using worker = await workerFixture()
    const initial = await worker.fetch('/')
    assert.equal(initial.status, 200)
    assert.match(await initial.text(), /Reliable systems &amp; small tools/)
    const original = await worker.fetch('/posts/reliable-systems')
    assert.match(await original.text(), /A real Notion paragraph crosses the REST adapter\./)
    worker.revise()
    const event = JSON.stringify({
      type: 'page.content_updated',
      subscription_id: authorization === 'other-subscription' ? 'different-subscription' : subscriptionId,
      entity: { type: 'page', id: articleId },
    })
    const signedBody = authorization === 'tampered' ? `${event} ` : event
    const signature = createHmac('sha256', webhookSecret).update(signedBody).digest('hex')
    const response = await worker.fetch('/api/notion/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization === 'unsigned' ? {} : { 'X-Notion-Signature': `sha256=${signature}` }),
      },
      body: event,
    })
    assert.equal(response.status, status)
    const home = html(await (await worker.fetch('/')).text())
    assert.equal(
      home.querySelector('#posts h3')?.textContent,
      authorization === 'signed' ? 'Revised reliable systems' : 'Reliable systems & small tools',
    )
    const article = html(await (await worker.fetch('/posts/reliable-systems')).text())
    assert.match(
      article.querySelector('.notion')?.textContent ?? '',
      authorization === 'signed'
        ? /The revised body arrived after a signed webhook\./
        : /A real Notion paragraph crosses the REST adapter\./,
    )
  }).catch(rejected)
}
