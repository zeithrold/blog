import assert from 'node:assert/strict'
import { test } from 'node:test'
import { publicationDomMigrations } from '~/tests/contracts/publication-dom-migrations'
import { publicationRemainingMigrations } from '~/tests/contracts/publication-remaining-migrations'
import { retirementOwnership } from '~/tests/contracts/registry'
import { deepEqual } from '~/tests/support/unit/assertions'

const titles = [
  'publishing retains the save failure reason DOCUMENT_TOO_LARGE and permits correction',
  'publishing retains the save failure reason INVALID_DOCUMENT and permits correction',
  'publishing retains the save failure reason CONNECTION_FAILED and permits correction',
]
const nativeTitle = 'the real Title field drives dirty status and saves corrected metadata'
const nativeKey = `tests/components/specs/publication-remaining.spec.ts :: ${nativeTitle}`

test('publication save failures preserve both historical migration generations', () => {
  const first = publicationRemainingMigrations.find(record => record.id === 'publication.save-failures')
  const second = publicationDomMigrations.find(record => record.id === 'publication.save-failures')
  assert.ok(first !== undefined)
  assert.ok(second !== undefined)

  const e2eKeys = titles.map(title => `tests/browser/publication/publication-save-errors.spec.ts :: ${title}`)
  const componentKeys = titles.map(title => `tests/components/specs/publication-remaining.spec.ts :: ${title}`)
  deepEqual(first.legacy, e2eKeys)
  deepEqual(first.component.map(proof => proof.case), [
    ...componentKeys,
    nativeKey,
  ])
  deepEqual(new Set(second.legacy), new Set([
    ...e2eKeys,
    ...componentKeys,
  ]))
  for (const title of titles) {
    const successor = `tests/dom/publication-remaining.test.tsx :: ${title}`
    assert.equal(second.dom.filter(proof => proof.case === successor).length, 1)
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Publication lineage failed'))

test('the real Title wiring successor is active proof, never invented legacy', () => {
  const first = publicationRemainingMigrations.find(record => record.id === 'publication.save-failures')
  assert.ok(first !== undefined)
  assert.equal(first.component.filter(proof => proof.case === nativeKey).length, 1)
  assert.equal(first.legacy.includes(nativeKey), false)
  assert.equal(retirementOwnership.complete.has(nativeKey), false)
  for (const record of publicationDomMigrations) {
    assert.equal(record.legacy.includes(nativeKey), false)
    assert.equal(record.retained.some(group => group.cases.includes(nativeKey)), false)
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Publication wiring failed'))
