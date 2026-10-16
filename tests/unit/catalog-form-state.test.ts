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
}

test('catalog refresh adopts all remote fields for a clean form', () => {
  const remote = { ...base, name: 'Remote', slug: 'remote', retired: true, version: 1 }
  deepEqual(rebaseCatalogFields(base, base, remote), { name: 'Remote', slug: 'remote', retired: true })
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('catalog refresh preserves local edits while adopting untouched remote fields', () => {
  const remote = { ...base, name: 'Remote', slug: 'remote', retired: true, version: 1 }
  deepEqual(rebaseCatalogFields({ ...base, name: 'Local' }, base, remote), {
    name: 'Local',
    slug: 'remote',
    retired: true,
  })
  deepEqual(rebaseCatalogFields({ ...base, slug: 'local', retired: true }, base, remote), {
    name: 'Remote',
    slug: 'local',
    retired: true,
  })
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
