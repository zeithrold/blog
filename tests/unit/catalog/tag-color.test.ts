import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyDocument } from '@/content/empty'
import { envelope } from '@/content/envelope'
import { catalogCreateSchema, catalogItemSchema } from '@/contracts/catalog'
import { deepEqual } from '~/tests/support/unit/assertions'

test('catalog colors default to neutral and reject arbitrary CSS values', () => {
  assert.equal(catalogCreateSchema.parse({ name: 'Tag', slug: 'tag' }).color, 'neutral')
  for (const color of [
    '#ffffff',
    'url(https://evil.test)',
    '',
    'BLUE',
    null,
  ]) {
    assert.equal(catalogCreateSchema.safeParse({ name: 'Tag', slug: 'tag', color }).success, false)
  }
  assert.equal(catalogItemSchema.parse({
    id: crypto.randomUUID(),
    kind: 'tag',
    name: 'Old',
    slug: 'old',
    retired: false,
    version: 0,
  }).color, 'neutral')
}).catch((error: unknown) => { throw error })

test('old tag snapshots stay unchanged while new snapshots retain their chosen color', () => {
  const document = emptyDocument()
  document.meta.tags = [
    { id: crypto.randomUUID(), slug: 'tag', label: 'Tag' },
  ]
  const original = structuredClone(document)
  deepEqual(envelope.parse(document), original)
  assert.equal(Object.hasOwn(envelope.parse(document).meta.tags[0] ?? {}, 'color'), false)
  const tag = document.meta.tags[0]
  assert.ok(tag !== undefined)
  document.meta.tags[0] = { ...tag, color: 'violet' }
  const colored = structuredClone(document)
  deepEqual(envelope.parse(document), colored)
}).catch((error: unknown) => { throw error })
