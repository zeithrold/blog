import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { sourceId } from '../support/worker/notion-fixture'
import { subscriptionId, webhookSecret, workerFixture } from '../support/worker/runtime'

function rejected(error: unknown): never {
  throw error instanceof Error ? error : new Error('Test registration failed', { cause: error })
}

test('native option descriptions render as plain text and enrich metadata by opaque ID', async () => {
  const description = 'Systems & recovery.\n日本語の技術ノート。 <em>Plain text</em>.'
  await using worker = await workerFixture({ tagId: 'native:/?#%', tagDescription: description })
  const response = await worker.fetch('/tags/native%3A%2F%3F%23%25')
  assert.equal(response.status, 200)
  const document = new JSDOM(await response.text()).window.document
  assert.equal(document.querySelector('main header p')?.textContent, description)
  assert.equal(document.querySelector('main header em'), null)
  assert.equal(
    document.querySelector('meta[name="description"]')?.getAttribute('content'),
    'Systems & recovery. 日本語の技術ノート。 <em>Plain text</em>.',
  )
  assert.equal(
    document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    `${worker.origin}/tags/native%3A%2F%3F%23%25`,
  )
}).catch(rejected)

for (const description of [
  null,
  '',
  ' \n ',
]) {
  test(`missing or blank native description ${JSON.stringify(description)} adds no invented introduction`, async () => {
    await using worker = await workerFixture({ tagDescription: description })
    const response = await worker.fetch('/tags/systems')
    assert.equal(response.status, 200)
    const document = new JSDOM(await response.text()).window.document
    assert.equal(document.querySelector('main header p')?.textContent, '2 posts')
    const sitemap = await (await worker.fetch('/sitemap.xml')).text()
    assert.doesNotMatch(sitemap, /\/tags\/systems|unused-tag/)
  }).catch(rejected)
}

test('sitemap includes described public tags but excludes unused topics and invented modification dates', async () => {
  await using worker = await workerFixture({ tagDescription: 'Authored systems introduction.' })
  const response = await worker.fetch('/sitemap.xml')
  assert.equal(response.status, 200)
  const document = new JSDOM(await response.text(), { contentType: 'text/xml' }).window.document
  const urls = Array.from(document.querySelectorAll('url'))
  const topic = urls.find(node => node.querySelector('loc')?.textContent === `${worker.origin}/tags/systems`)
  assert.ok(topic !== undefined)
  assert.equal(topic.querySelector('lastmod'), null)
  assert.equal(urls.some(node => (node.querySelector('loc')?.textContent ?? '').includes('unused-tag')), false)
}).catch(rejected)

test('a signed schema update refreshes authored introductions and sitemap eligibility', async () => {
  await using worker = await workerFixture()
  const initial = await worker.fetch('/tags/systems')
  assert.equal(new JSDOM(await initial.text()).window.document.querySelector('main header p')?.textContent, '2 posts')
  worker.reviseTagDescription()
  const cached = await worker.fetch('/tags/systems')
  assert.equal(new JSDOM(await cached.text()).window.document.querySelector('main header p')?.textContent, '2 posts')
  const event = JSON.stringify({
    type: 'data_source.schema_updated',
    subscription_id: subscriptionId,
    entity: { type: 'data_source', id: sourceId },
  })
  const signature = createHmac('sha256', webhookSecret).update(event).digest('hex')
  assert.equal((await worker.fetch('/api/notion/webhook', {
    method: 'POST',
    headers: { 'X-Notion-Signature': `sha256=${signature}` },
    body: event,
  })).status, 204)
  const refreshed = new JSDOM(await (await worker.fetch('/tags/systems')).text()).window.document
  assert.equal(
    refreshed.querySelector('main header p')?.textContent,
    'Revised introduction from the native Tag option.',
  )
  assert.match(await (await worker.fetch('/sitemap.xml')).text(), /\/tags\/systems/)
}).catch(rejected)
