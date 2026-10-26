import type { Layer } from '~/tests/contracts/types'
import assert from 'node:assert/strict'
import { test as nodeTest } from 'node:test'
import { assessContracts } from '~/tests/contracts/assess'
import { documentsCatalogContracts, primaryProof, retirementOwnership } from '~/tests/contracts/registry'

/*
 * The primary layer of a rule, checked as a rule rather than as today's table.
 *
 * A migration retires the cases of the layer that used to carry a rule; the rule
 * must then name the layer that actually proves it. These cases pin the chain
 * `e2e` → `component` → `dom` in both directions: it moves only to a layer with a
 * reference, and it never moves to one that has none, so a retirement without a
 * successor still fails the contract gate instead of passing on an empty list.
 * The last case proves that fail-closed behaviour through the real assessment.
 */

const carried = ['a case']
const none: readonly unknown[] = []

function primary(layer: Layer, counts: {
  component?: readonly unknown[]
  dom?: readonly unknown[]
  e2e?: readonly unknown[]
}): Layer {
  return primaryProof({
    primary: layer,
    component: counts.component ?? none,
    dom: counts.dom ?? none,
    e2e: counts.e2e ?? none,
  })
}

nodeTest('a rule keeps its own layer while that layer still has a reference', () => {
  assert.equal(primary('component', { component: carried }), 'component')
  assert.equal(primary('e2e', { e2e: carried }), 'e2e')
  assert.equal(primary('dom', { dom: carried }), 'dom')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

nodeTest('a retired e2e rule moves to the component layer that now proves it', () => {
  assert.equal(primary('e2e', { component: carried }), 'component')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

nodeTest('a retired component rule moves to the DOM layer that now proves it', () => {
  assert.equal(primary('component', { dom: carried }), 'dom')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

nodeTest('a rule whose e2e and component cases both retired moves straight to the DOM layer', () => {
  assert.equal(primary('e2e', { dom: carried }), 'dom')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

nodeTest('a rule never moves up, or sideways to a layer that ran no case', () => {
  assert.equal(primary('component', { e2e: carried }), 'component')
  assert.equal(primary('dom', { component: carried }), 'dom')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

nodeTest('a rule whose primary layer emptied with no successor keeps that layer', () => {
  assert.equal(primary('component', {}), 'component')
  assert.equal(primary('e2e', {}), 'e2e')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

nodeTest('unit and integration primaries are never moved by the browser chain', () => {
  assert.equal(primary('unit', { dom: carried }), 'unit')
  assert.equal(primary('integration', { component: carried }), 'integration')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

nodeTest('a retirement with no successor still fails the contract gate', () => {
  const runId = 'run'
  const source = { revision: 'revision', fingerprint: 'fingerprint' }
  const emptied = {
    id: 'rule.emptied',
    behavior: 'the rule under test',
    primary: primary('component', {}),
    unit: [],
    integration: [],
    dom: [],
    component: [],
    e2e: [],
    dimensions: [],
    rationale: 'a retirement must name the layer that now proves it',
  }
  const assessment = assessContracts([emptied], [], runId, source)
  assert.equal(assessment.passed, false)
  assert.deepEqual(assessment.issues, [
    {
      contract: 'rule.emptied',
      layer: 'component',
      reason: 'Primary proof layer has no references',
    },
  ])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

nodeTest('no rule cites a completely retired component case', () => {
  const cited = documentsCatalogContracts
    .flatMap(contract => contract.component.map(reference => `${reference.file} :: ${reference.title}`))
  assert.deepEqual(
    cited.filter(key => retirementOwnership.complete.has(key)),
    [],
    'A completely retired component case is not current proof',
  )
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
