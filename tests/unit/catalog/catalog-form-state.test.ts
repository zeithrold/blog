import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acceptCatalogEntry, rebaseCatalogFields } from '@/features/catalog/catalog-form-state'
import { deepEqual } from '~/tests/support/unit/assertions'

const base = {
  id: crypto.randomUUID(),
  kind: 'tag' as const,
  name: 'Original',
  slug: 'original',
  version: 0,
  retired: false,
  color: 'neutral' as const,
}

test('catalog refresh adopts all remote fields for a clean form', () => {
  const remote = { ...base, name: 'Remote', slug: 'remote', retired: true, version: 1 }
  deepEqual(rebaseCatalogFields(base, base, remote), {
    name: 'Remote',
    slug: 'remote',
    retired: true,
    color: 'neutral',
  })
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('catalog refresh preserves local edits while adopting untouched remote fields', () => {
  const remote = { ...base, name: 'Remote', slug: 'remote', retired: true, version: 1 }
  deepEqual(rebaseCatalogFields({ ...base, name: 'Local' }, base, remote), {
    name: 'Local',
    slug: 'remote',
    retired: true,
    color: 'neutral',
  })
  deepEqual(rebaseCatalogFields({ ...base, slug: 'local', retired: true }, base, remote), {
    name: 'Remote',
    slug: 'local',
    retired: true,
    color: 'neutral',
  })
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('catalog refresh adopts untouched colors but preserves local color edits', () => {
  const remote = { ...base, color: 'blue' as const, version: 1 }
  assert.equal(rebaseCatalogFields(base, base, remote).color, 'blue')
  assert.equal(rebaseCatalogFields({ ...base, color: 'red' }, base, remote).color, 'red')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('catalog acknowledgement replaces its row without mutating or duplicating existing entries', () => {
  const other = { ...base, id: crypto.randomUUID(), name: 'Another', slug: 'another' }
  const saved = { ...base, name: 'Updated', version: 1 }
  const original = [base, other]
  const result = acceptCatalogEntry(original, saved)
  deepEqual(result, [other, saved])
  deepEqual(original, [base, other])
  deepEqual(acceptCatalogEntry([], saved), [saved])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
