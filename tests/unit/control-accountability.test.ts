import type { ControlAccountability } from '~/tests/contracts/control-map'
import type { VerificationContract } from '~/tests/contracts/types'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assessControlMap } from '~/tests/contracts/accountability'
import { documentsCatalogControlMap } from '~/tests/contracts/control-map'
import { migratedControls } from '~/tests/contracts/legacy'
import { documentsCatalogContracts } from '~/tests/contracts/registry'
import { controls } from '~/tests/support/browser/control-contract'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

// Synthetic fixtures: the accountability table is judged by its own rules, never
// by whichever rows the real documents/catalog inventory happens to hold.
const mappedRule = 'documents.list-form-wiring'
const otherRule = 'documents.list-hydration'
const browserCase = {
  file: 'tests/components/specs/documents-list.spec.ts',
  title: 'filters narrow the list and their chips remove individually',
  projects: ['chromium', 'webkit'] as const,
}
const e2eCase = {
  file: 'tests/browser/documents/documents.spec.ts',
  title: 'documents retry, filter, recover trash and keep bilingual mobile UI',
  projects: ['chromium', 'webkit'] as const,
}

function rule(fields: Partial<VerificationContract> = {}): VerificationContract {
  return {
    id: mappedRule,
    behavior: 'The search form submits the typed query',
    primary: 'component',
    unit: [],
    integration: [],
    component: [browserCase],
    e2e: [],
    dimensions: [],
    rationale: 'Synthetic fixture',
    ...fields,
  }
}

function row(fields: Partial<ControlAccountability> = {}): ControlAccountability {
  return {
    id: 'documents.search',
    surface: 'documents',
    locator: 'Search',
    contracts: [mappedRule],
    asserted: true,
    retainedBy: [],
    note: 'Synthetic fixture',
    ...fields,
  }
}

/** The inventory's own control shape, reduced to the ids a fixture needs. */
function controlRows(...locators: readonly string[]) {
  return controls('documents', [], [], locators.map(locator => [locator, 'submits the query'] as const))
}

const search = controlRows('Search')
const mappedRow = row()
const baseRule = rule()

// The ledger as the verifier sees it, so each rule is judged by its own primary layer.
const canonical: readonly VerificationContract[] = documentsCatalogContracts
const canonicalMap: readonly ControlAccountability[] = documentsCatalogControlMap

test('a mapped table with browser wiring reports no issues', () => {
  deepEqual(assessControlMap(search, [mappedRow], [baseRule]), [])
}).catch((error: unknown) => { throw error })

test('a control proved by a real E2E case is still wired', () => {
  const navigated = rule({
    primary: 'e2e',
    component: [],
    e2e: [e2eCase],
  })
  deepEqual(assessControlMap(search, [mappedRow], [navigated]), [])
}).catch((error: unknown) => { throw error })

test('a control missing from the mapping is reported by ID', () => {
  const table = controlRows('Search', 'Clear')
  deepEqual(assessControlMap(table, [mappedRow], [baseRule]), ['Unmapped migrated control: documents.clear'])
}).catch((error: unknown) => { throw error })

test('duplicate control IDs are reported', () => {
  const duplicated = [mappedRow, mappedRow]
  deepEqual(assessControlMap(search, duplicated, [baseRule]), ['Control mapping contains duplicate IDs'])
}).catch((error: unknown) => { throw error })

test('a control ID the inventory never declared is reported', () => {
  const ghost = row({
    id: 'documents.ghost',
    locator: 'Ghost',
  })
  deepEqual(assessControlMap(search, [ghost], [baseRule]), [
    'Unmapped migrated control: documents.search',
    'Control mapping contains an unknown ID: documents.ghost',
  ])
}).catch((error: unknown) => { throw error })

test('a control citing a rule outside the ledger is unresolved', () => {
  const unresolved = row({ contracts: [otherRule] })
  deepEqual(assessControlMap(search, [unresolved], [baseRule]), [
    'Control cites an unknown rule: documents.search',
    'Control has no browser wiring proof: documents.search',
  ])
}).catch((error: unknown) => { throw error })

test('an unasserted control is reported as a gap', () => {
  const unasserted = row({ asserted: false })
  deepEqual(assessControlMap(search, [unasserted], [baseRule]), [
    'Control still has an explicit coverage gap: documents.search',
  ])
}).catch((error: unknown) => { throw error })

test('a control without a contract leaves an explicit gap', () => {
  const unclaimed = row({ contracts: [] })
  deepEqual(assessControlMap(search, [unclaimed], [baseRule]), [
    'Control still has an explicit coverage gap: documents.search',
    'Control has no browser wiring proof: documents.search',
  ])
}).catch((error: unknown) => { throw error })

test('a node-only rule is never browser wiring proof', () => {
  const nodeOnly = rule({
    primary: 'unit',
    component: [],
    unit: [
      {
        file: 'tests/unit/document-list.test.ts',
        title: 'document queries reject unknown/duplicate fields and filter-incompatible cursors',
      },
    ],
  })
  deepEqual(assessControlMap(search, [mappedRow], [nodeOnly]), [
    'Control has no browser wiring proof: documents.search',
  ])
}).catch((error: unknown) => { throw error })

test('the canonical registry proves every primary layer and leaves no control gap', () => {
  const unproven = canonical.filter(contract => contract[contract.primary].length === 0)
    .map(contract => contract.id)
  deepEqual(unproven, [])
  deepEqual(assessControlMap(migratedControls, canonicalMap, canonical), [])
  const gaps = canonicalMap.filter(entry => !entry.asserted).map(entry => entry.id)
  deepEqual(gaps, [])
  equal(canonical.length, documentsCatalogContracts.length)
  assert.ok(canonical.length > 0, 'The ledger must hold the migrated contracts')
}).catch((error: unknown) => { throw error })
