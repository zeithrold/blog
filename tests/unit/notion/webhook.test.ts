import type { NotionBindings } from '@/server/notion/bindings'
import assert, { equal } from 'node:assert/strict'
import { test } from 'node:test'
import { cacheKey } from '@/server/notion/cache'
import { handleWebhook } from '@/server/notion/webhook'
import { fixture, pageId, source } from './fixtures'

async function signed(body: string, secret = 'unit-webhook-secret') {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  const signature = `sha256=${Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')}`
  return new Request('https://example.test/api/notion/webhook', {
    method: 'POST',
    body,
    headers: { 'X-Notion-Signature': signature },
  })
}

function event(id = pageId, type = 'page.content_updated', entityType = 'page') {
  return JSON.stringify({
    type,
    subscription_id: 'subscription',
    entity: { id, type: entityType },
    data: { parent: { id: source, type: 'data_source' } },
  })
}

async function seed(bindings: NotionBindings) {
  await bindings.NOTION_CACHE.put(cacheKey(bindings, 'catalog'), 'catalog')
  await bindings.NOTION_CACHE.put(cacheKey(bindings, `page:${pageId}`), 'page')
}

test('unsigned and incorrectly signed payloads cannot mutate cached content', async (t) => {
  const bindings = await fixture(t)
  await seed(bindings)
  for (const request of [
    new Request('https://example.test/api/notion/webhook', { method: 'POST', body: event() }),
    await signed(event(), 'wrong-secret'),
  ]) {
    equal((await handleWebhook(request, bindings)).status, 401)
  }
  equal(await bindings.NOTION_CACHE.get(cacheKey(bindings, 'catalog')), 'catalog')
  equal(await bindings.NOTION_CACHE.get(cacheKey(bindings, `page:${pageId}`)), 'page')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('valid repeated page events invalidate both caches idempotently', async (t) => {
  const bindings = await fixture(t)
  await seed(bindings)
  for (let attempt = 0; attempt < 2; attempt++) {
    equal((await handleWebhook(await signed(event()), bindings)).status, 204)
  }
  equal(await bindings.NOTION_CACHE.get(cacheKey(bindings, 'catalog')), null)
  equal(await bindings.NOTION_CACHE.get(cacheKey(bindings, `page:${pageId}`)), null)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('data source events only invalidate the configured source catalog', async (t) => {
  const bindings = await fixture(t)
  await seed(bindings)
  await handleWebhook(await signed(event(pageId, 'data_source.schema_updated', 'data_source')), bindings)
  equal(await bindings.NOTION_CACHE.get(cacheKey(bindings, 'catalog')), 'catalog')
  await handleWebhook(await signed(event(source, 'data_source.schema_updated', 'data_source')), bindings)
  equal(await bindings.NOTION_CACHE.get(cacheKey(bindings, 'catalog')), null)
  equal(await bindings.NOTION_CACHE.get(cacheKey(bindings, `page:${pageId}`)), 'page')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('authenticated malformed and wrong subscription payloads do not invalidate caches', async (t) => {
  const bindings = { ...await fixture(t), NOTION_WEBHOOK_SUBSCRIPTION_ID: 'other' }
  await seed(bindings)
  equal((await handleWebhook(await signed('{'), bindings)).status, 400)
  equal((await handleWebhook(await signed('{}'), bindings)).status, 400)
  equal((await handleWebhook(await signed(event()), bindings)).status, 403)
  equal(await bindings.NOTION_CACHE.get(cacheKey(bindings, 'catalog')), 'catalog')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('authenticated oversized bodies are rejected and unsigned setup cannot configure secrets', async (t) => {
  const bindings = await fixture(t)
  equal((await handleWebhook(await signed('x'.repeat(1024 * 1024 + 1)), bindings)).status, 413)
  equal((await handleWebhook(new Request('https://example.test/api/notion/webhook', {
    method: 'POST',
    body: JSON.stringify({ verification_token: 'untrusted' }),
  }), { ...bindings, NOTION_WEBHOOK_SECRET: undefined })).status, 503)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('KV deletion failure propagates for webhook retry', async (t) => {
  const bindings = await fixture(t)
  const unavailable = new Proxy(bindings.NOTION_CACHE, {
    get(target, property, receiver): unknown {
      if (property === 'delete') {
        return async () => await Promise.reject(new Error('KV unavailable'))
      }
      return Reflect.get(target, property, receiver)
    },
  })
  const result = handleWebhook(await signed(event()), { ...bindings, NOTION_CACHE: unavailable })
  await assert.rejects(result, /KV unavailable/)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('setup challenge requires the setup token and is retrievable only during setup', async (t) => {
  const bindings = {
    ...await fixture(t),
    NOTION_WEBHOOK_SECRET: undefined,
    NOTION_WEBHOOK_SETUP_TOKEN: 'setup-token-with-at-least-32-characters',
  }
  const endpoint = 'https://example.test/api/notion/webhook'
  const url = `${endpoint}?setup=${bindings.NOTION_WEBHOOK_SETUP_TOKEN}`
  equal((await handleWebhook(new Request(url), bindings)).status, 404)
  for (const target of [
    endpoint,
    `${endpoint}?setup=wrong`,
  ]) {
    equal((await handleWebhook(new Request(target, {
      method: 'POST',
      body: JSON.stringify({ verification_token: 'attacker-token' }),
    }), bindings)).status, 403)
  }
  equal(await bindings.NOTION_CACHE.get(cacheKey(bindings, 'webhook-verification')), null)
  equal((await handleWebhook(new Request(url, {
    method: 'POST',
    body: JSON.stringify({ verification_token: 'notion-verification-token' }),
  }), bindings)).status, 204)
  const response = await handleWebhook(new Request(url), bindings)
  equal(response.status, 200)
  equal(response.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(await response.json(), { verification_token: 'notion-verification-token' })
  const configured = { ...bindings, NOTION_WEBHOOK_SECRET: 'notion-verification-token' }
  equal((await handleWebhook(new Request(url), configured)).status, 405)
  equal((await handleWebhook(new Request(url, {
    method: 'POST',
    body: JSON.stringify({ verification_token: 'replacement' }),
  }), configured)).status, 401)
  equal(await bindings.NOTION_CACHE.get(cacheKey(bindings, 'webhook-verification')), 'notion-verification-token')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
