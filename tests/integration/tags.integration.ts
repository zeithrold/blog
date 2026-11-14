import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { workerFixture } from '../support/worker/runtime'

function rejected(error: unknown): never {
  throw error instanceof Error ? error : new Error('Test registration failed', { cause: error })
}

test('tag index counts published articles without counting pages or drafts', async () => {
  await using worker = await workerFixture()
  const response = await worker.fetch('/tags')
  assert.equal(response.status, 200)
  const document = new JSDOM(await response.text()).window.document
  const links = Array.from(document.querySelectorAll('main a[href="/tags/systems"]'))
  assert.equal(links.length, 1)
  const link = links.at(0)
  assert.ok(link !== undefined)
  assert.equal(link.textContent.trim(), 'Systems')
  assert.match(link.closest('li')?.textContent ?? '', /2 posts/)
  assert.equal(document.querySelectorAll('main .reader-tag[data-tag-color="blue"]').length, 1)
}).catch(rejected)

test('tag detail returns the ordered public article set and article navigation', async () => {
  await using worker = await workerFixture()
  const response = await worker.fetch('/tags/systems')
  assert.equal(response.status, 200)
  const document = new JSDOM(await response.text()).window.document
  assert.equal(document.querySelector('h1')?.textContent, 'Systems')
  assert.deepEqual(
    Array.from(document.querySelectorAll('#posts .post-list a')).map(link => link.getAttribute('href')),
    ['/posts/reliable-systems', '/posts/second-note'],
  )
  assert.match(document.querySelector('main header')?.textContent ?? '', /2 posts/)
  assert.ok(document.querySelector('main a[href="/tags"]') !== null)
}).catch(rejected)

test('tag routes round-trip opaque native IDs through their actual published links', async () => {
  await using worker = await workerFixture({ tagId: 'native:/?#%' })
  const index = await worker.fetch('/tags')
  const document = new JSDOM(await index.text()).window.document
  const href = document.querySelector('main .reader-tag')?.getAttribute('href')
  assert.equal(href, '/tags/native%3A%2F%3F%23%25')
  const response = await worker.fetch(href)
  assert.equal(response.status, 200)
  const detail = new JSDOM(await response.text()).window.document
  assert.deepEqual(
    Array.from(detail.querySelectorAll('#posts .post-list a')).map(link => link.getAttribute('href')),
    ['/posts/reliable-systems', '/posts/second-note'],
  )
}).catch(rejected)

test('tag identity comes from the URL even when a caller supplies the internal path header', async () => {
  await using worker = await workerFixture()
  const response = await worker.fetch('/tags/systems', {
    headers: { 'x-blog-request-path': '/tags/unknown' },
  })
  assert.equal(response.status, 200)
  const document = new JSDOM(await response.text()).window.document
  assert.equal(document.querySelector('h1')?.textContent, 'Systems')
}).catch(rejected)

test('tag pagination retains its native identity and every article across pages', async () => {
  await using worker = await workerFixture({ additionalPostCount: 49 })
  const first = await worker.fetch('/tags/systems')
  assert.equal(first.status, 200)
  const firstDocument = new JSDOM(await first.text()).window.document
  const firstPaths = Array.from(firstDocument.querySelectorAll('#posts .post-list a'))
    .map(link => link.getAttribute('href'))
  assert.equal(firstPaths.length, 50)
  const next = firstDocument.querySelector('a[href^="/tags/systems?offset=50"]')
  assert.ok(next !== null)
  const nextPath = next.getAttribute('href')
  assert.ok(nextPath !== null)
  const second = await worker.fetch(nextPath)
  assert.equal(second.status, 200)
  const secondDocument = new JSDOM(await second.text()).window.document
  const secondPaths = Array.from(secondDocument.querySelectorAll('#posts .post-list a'))
    .map(link => link.getAttribute('href'))
  assert.equal(secondPaths.length, 1)
  assert.deepEqual(
    new Set([
      ...firstPaths,
      ...secondPaths,
    ]),
    new Set([
      ...Array.from({ length: 49 }, (_, index) => `/posts/extra-post-${index}`),
      '/posts/reliable-systems',
      '/posts/second-note',
    ]),
  )
  assert.equal(secondDocument.querySelectorAll('a[href*="?offset="]').length, 0)
}).catch(rejected)

for (const path of [
  '/tags/unknown',
  '/tags/systems?offset=-1',
  '/tags/systems?offset=1.5',
  '/tags/systems?offset=100001',
  '/tags/systems?offset=0&offset=50',
]) {
  test(`invalid tag request ${path} returns 404`, async () => {
    await using worker = await workerFixture()
    const response = await worker.fetch(path)
    assert.equal(response.status, 404)
  }).catch(rejected)
}

for (const path of [
  '/tags/%ZZ',
  '/tags/%C3%28',
  '/posts/reliable%2Dsystems.md',
]) {
  test(`malformed or disallowed encoded path ${path} returns 400`, async () => {
    await using worker = await workerFixture()
    const response = await worker.fetch(path)
    assert.equal(response.status, 400)
  }).catch(rejected)
}
