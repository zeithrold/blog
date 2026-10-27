import type { CatalogItem } from '@/features/catalog/catalog-controller'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyDocument } from '@/content/empty'
import { selectedCatalogMeta } from '@/features/catalog/catalog-controller'
import { deepEqual } from '~/tests/support/unit/assertions'

function entry(kind: 'tag' | 'series', name: string, retired = false): CatalogItem {
  return { id: crypto.randomUUID(), kind, name, slug: name.toLowerCase(), version: 1, retired, color: 'blue' }
}

test('tag selection preserves saved snapshots and rejects retired additions', () => {
  const meta = emptyDocument().meta
  const retired = entry('tag', 'Retired', true)
  const active = entry('tag', 'Active')
  const missing = { id: crypto.randomUUID(), slug: 'missing', label: 'Historical missing tag' }
  const original = { id: retired.id, slug: 'original-slug', label: 'Original label' }
  meta.tags = [original, missing]
  const result = selectedCatalogMeta(meta, [retired, active], 'tag', [
    retired.id,
    missing.id,
    active.id,
    active.id,
  ])
  deepEqual(result.tags, [
    original,
    missing,
    { id: active.id, slug: active.slug, label: active.name, color: 'blue' },
  ])
  assert.equal(result.tags[0], original)
  assert.deepEqual(selectedCatalogMeta(meta, [retired], 'tag', []).tags, [])
  meta.tags = []
  assert.deepEqual(selectedCatalogMeta(meta, [retired], 'tag', [retired.id]).tags, [])
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('series selection replaces the choice, preserves its position and clears cleanly', () => {
  const meta = emptyDocument().meta
  const first = entry('series', 'First')
  const second = entry('series', 'Second')
  const saved = { id: first.id, slug: 'saved', title: 'Saved title', position: 42 }
  meta.series = [saved]
  assert.equal(selectedCatalogMeta(meta, [first, second], 'series', [first.id]).series[0], saved)
  deepEqual(selectedCatalogMeta(meta, [first, second], 'series', [second.id]).series, [
    { id: second.id, slug: second.slug, title: second.name, position: 1000 },
  ])
  assert.equal(selectedCatalogMeta(meta, [first, second], 'series', [first.id, second.id]).series.length, 1)
  assert.deepEqual(selectedCatalogMeta(meta, [first, second], 'series', []).series, [])
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
