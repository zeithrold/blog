import assert, { deepEqual, equal } from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'
import { cacheKey, deadline, envelopeSchema, readCache, writeCache } from '@/server/notion/cache'
import { fixture } from './fixtures'

test('cache deadlines start at fetch time and stop before earliest media expiry', () => {
  equal(deadline(1_000_000, 300, [
    null,
    1_200_000,
    1_150_000,
  ]), 1_090_000)
  equal(deadline(1_000_000, 60, []), 1_060_000)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('KV cache round trips complete envelopes and rejects stale values returned by KV', async (t) => {
  const bindings = await fixture(t)
  const now = Date.now()
  const key = cacheKey(bindings, 'page:test')
  const snapshot = { fetchedAt: now, freshUntil: now + 300_000, value: 'complete' }
  const schema = envelopeSchema.extend({ value: z.string() })
  await writeCache(bindings, key, snapshot)
  deepEqual(await readCache(bindings, key, schema), snapshot)
  await bindings.NOTION_CACHE.put(key, JSON.stringify({ ...snapshot, freshUntil: now - 1 }))
  equal(await readCache(bindings, key, schema), null)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('KV skips writes whose application freshness has already expired', async (t) => {
  const bindings = await fixture(t)
  const key = cacheKey(bindings, 'catalog')
  await writeCache(bindings, key, { fetchedAt: Date.now() - 60_000, freshUntil: Date.now() - 1 })
  equal(await bindings.NOTION_CACHE.get(key), null)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a catalog fetched two seconds ago remains cached until its embedded deadline', async (t) => {
  const bindings = await fixture(t)
  const now = Date.now()
  t.mock.method(Date, 'now', () => now)
  const key = cacheKey(bindings, 'catalog')
  const snapshot = { fetchedAt: now - 2000, freshUntil: now + 58_000, value: 'catalog' }
  const schema = envelopeSchema.extend({ value: z.string() })

  await writeCache(bindings, key, snapshot)

  deepEqual(await readCache(bindings, key, schema), snapshot)
  t.mock.method(Date, 'now', () => snapshot.freshUntil)
  equal(await readCache(bindings, key, schema), null)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
