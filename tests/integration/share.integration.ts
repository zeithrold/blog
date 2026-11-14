import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { z } from 'zod'
import { articleId } from '../support/worker/notion-fixture'
import { workerFixture } from '../support/worker/runtime'

function rejected(error: unknown): never {
  throw error instanceof Error ? error : new Error('Test registration failed', { cause: error })
}

const structuredPage = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.enum(['BlogPosting', 'WebPage']),
  'headline': z.string(),
  'description': z.string(),
  'url': z.url(),
  'image': z.url(),
  'datePublished': z.iso.datetime(),
  'dateModified': z.iso.datetime(),
  'author': z.object({
    '@type': z.literal('Person'),
    'name': z.literal('Zeithrold'),
    'url': z.url(),
  }),
  'mainEntityOfPage': z.object({
    '@type': z.literal('WebPage'),
    '@id': z.url(),
  }).optional(),
})

for (const path of [
  '/',
  '/tags',
  '/tags/systems',
  '/search?q=systems',
  '/licenses',
]) {
  test(`${path} exposes an absolute raster fallback in both share protocols`, async () => {
    await using worker = await workerFixture()
    const response = await worker.fetch(path)
    assert.equal(response.status, 200)
    const document = new JSDOM(await response.text()).window.document
    assert.deepEqual(
      Array.from(document.querySelectorAll('meta[property="og:image"]')).map(meta => meta.getAttribute('content')),
      [
        `${worker.origin}/share.png`,
      ],
    )
    assert.deepEqual(
      Array.from(document.querySelectorAll('meta[name="twitter:image"]')).map(meta => meta.getAttribute('content')),
      [
        `${worker.origin}/share.png`,
      ],
    )
    assert.equal(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content'), 'summary_large_image')
    assert.equal(document.querySelector('meta[property="og:image:type"]')?.getAttribute('content'), 'image/png')
    assert.equal(document.querySelector('meta[property="og:image:width"]')?.getAttribute('content'), '1200')
    assert.equal(document.querySelector('meta[property="og:image:height"]')?.getAttribute('content'), '630')
    assert.equal(
      document.querySelector('meta[name="twitter:image:alt"]')?.getAttribute('content'),
      'zeithrold/blog - Notes on building things.',
    )
    assert.equal(
      document.querySelector('meta[property="og:image:alt"]')?.getAttribute('content'),
      'zeithrold/blog - Notes on building things.',
    )
  }).catch(rejected)
}

for (const [path, kind, title] of [
  [
    '/posts/reliable-systems',
    'BlogPosting',
    'Reliable systems & small tools',
  ],
  [
    '/posts/second-note',
    'BlogPosting',
    'A second field note',
  ],
  [
    '/pages/about',
    'WebPage',
    'About this notebook',
  ],
] as const) {
  test(`${path} shares its own title and image with eligible structured data`, async () => {
    await using worker = await workerFixture()
    const response = await worker.fetch(path)
    assert.equal(response.status, 200)
    const document = new JSDOM(await response.text()).window.document
    assert.equal(document.querySelector('meta[property="og:title"]')?.getAttribute('content'), title)
    assert.equal(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'), title)
    assert.equal(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content'), 'summary_large_image')
    assert.equal(
      document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
      `${worker.origin}/share.png`,
    )
    assert.equal(
      document.querySelector('meta[name="twitter:image"]')?.getAttribute('content'),
      `${worker.origin}/share.png`,
    )
    assert.equal(
      document.querySelector('meta[name="twitter:description"]')?.getAttribute('content'),
      'Field notes on resilient systems & practical design.',
    )
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    assert.equal(scripts.length, 1)
    const script = scripts[0]
    assert.ok(script !== undefined)
    const data = structuredPage.parse(JSON.parse(script.textContent))
    assert.ok(data['@type'] === kind)
    assert.equal(data.headline, title)
    assert.ok(data.url === worker.origin + path)
    assert.ok(data.image === `${worker.origin}/share.png`)
    assert.equal(data.author.url, 'https://github.com/zeithrold')
    if (kind === 'BlogPosting') {
      assert.ok(data.mainEntityOfPage?.['@id'] === worker.origin + path)
    }
    else {
      assert.equal(data.mainEntityOfPage, undefined)
    }
  }).catch(rejected)
}

test('the built Worker serves the share image as a real 1200 by 630 PNG', async () => {
  await using worker = await workerFixture()
  const response = await worker.fetch('/share.png')
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /^image\/png(?:;|$)/)
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR')
  assert.equal(bytes.readUInt32BE(16), 1200)
  assert.equal(bytes.readUInt32BE(20), 630)
}).catch(rejected)

test('a covered article shares its stable media URL across metadata and structured data', async () => {
  await using worker = await workerFixture({ articleCover: true })
  const response = await worker.fetch('/posts/reliable-systems')
  assert.equal(response.status, 200)
  const document = new JSDOM(await response.text()).window.document
  const cover = `${worker.origin}/notion-media/${articleId}/cover`
  assert.deepEqual(
    Array.from(document.querySelectorAll('meta[property="og:image"]')).map(meta => meta.getAttribute('content')),
    [cover],
  )
  assert.deepEqual(
    Array.from(document.querySelectorAll('meta[name="twitter:image"]')).map(meta => meta.getAttribute('content')),
    [cover],
  )
  assert.equal(
    document.querySelector('meta[property="og:image:alt"]')?.getAttribute('content'),
    'Reliable systems & small tools',
  )
  assert.equal(document.querySelector('meta[property="og:image:width"]'), null)
  const data = structuredPage.parse(JSON.parse(
    document.querySelector('script[type="application/ld+json"]')?.textContent ?? 'null',
  ))
  assert.ok(data.image === cover)
  const redirect = await worker.fetch(`/notion-media/${articleId}/cover`, { redirect: 'manual' })
  assert.equal(redirect.status, 302)
  assert.equal(redirect.headers.get('location'), 'https://media.example/notion-cover.png')
}).catch(rejected)

for (const path of [
  '/posts/unreleased-secret',
  '/posts/absent',
  '/pages/absent',
  '/posts/second-note',
]) {
  test(`${path} cannot expose article structured data when ineligible`, async () => {
    await using worker = await workerFixture({ invalidPostSlug: true })
    const response = await worker.fetch(path)
    assert.equal(response.status, 404)
    const document = new JSDOM(await response.text()).window.document
    assert.equal(document.querySelector('script[type="application/ld+json"]'), null)
    assert.equal(document.querySelector('meta[property="og:type"][content="article"]'), null)
  }).catch(rejected)
}

test('a previously public cached article loses structured data when unpublished', async () => {
  await using worker = await workerFixture()
  assert.equal((await worker.fetch('/posts/reliable-systems')).status, 200)
  worker.unpublish()
  const response = await worker.fetch('/posts/reliable-systems')
  assert.equal(response.status, 404)
  const document = new JSDOM(await response.text()).window.document
  assert.equal(document.querySelector('script[type="application/ld+json"]'), null)
  assert.equal(document.querySelector('meta[property="og:type"][content="article"]'), null)
}).catch(rejected)
