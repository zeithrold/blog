import type { LayerEvidence, VerificationContract } from '~/tests/contracts/types'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assessContracts } from '~/tests/contracts/assess'

const runId = '20751f13-8598-424e-bca9-43042f3c76d2'
const source = { revision: 'source-commit', fingerprint: 'source-fingerprint' }
const contract: VerificationContract = {
  id: 'documents.refresh-intent',
  behavior: 'A late refresh does not replace the current search intent',
  primary: 'unit',
  unit: [
    { file: 'tests/unit/example.test.ts', title: 'late refresh' },
  ],
  integration: [],
  component: [
    {
      file: 'tests/components/specs/example.spec.ts',
      title: 'retains typed search',
      projects: ['chromium', 'webkit'],
    },
  ],
  e2e: [],
  dimensions: ['request-order'],
  rationale: 'Rules are exhaustive in unit; real components prove their UI wiring.',
}

function reports(): LayerEvidence[] {
  return [
    {
      schemaVersion: 1,
      layer: 'unit',
      runId,
      source,
      complete: true,
      cases: [
        { file: contract.unit[0]?.file ?? '', title: 'late refresh', describe: [], status: 'passed', retry: 0 },
      ],
    },
    {
      schemaVersion: 1,
      layer: 'component',
      runId,
      source,
      complete: true,
      cases: (['chromium', 'webkit'] as const).map(project => ({
        file: 'tests/components/specs/example.spec.ts',
        title: 'retains typed search',
        describe: [],
        project,
        status: 'passed',
        retry: 0,
      })),
    },
  ]
}

test('contracts require exact passing cases in each declared layer and browser', () => {
  assert.ok(assessContracts([contract], reports(), runId, source).passed)
  const missing = reports()
  missing[1]?.cases.pop()
  assert.ok(!assessContracts([contract], missing, runId, source).passed)
  const wrongCase = reports()
  const unitCase = wrongCase[0]?.cases[0]
  if (unitCase !== undefined) {
    unitCase.title = 'another test in the same file'
  }
  assert.ok(!assessContracts([contract], wrongCase, runId, source).passed)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('old runs, old sources and incomplete runs cannot lend contract evidence', () => {
  for (const mutation of [
    (report: LayerEvidence) => {
      report.runId = null
    },
    (report: LayerEvidence) => {
      report.source = { ...source, fingerprint: 'old' }
    },
    (report: LayerEvidence) => {
      report.complete = false
    },
  ]) {
    const stale = reports()
    stale.forEach(mutation)
    assert.ok(!assessContracts([contract], stale, runId, source).passed)
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('skips, failures, retries and ambiguous duplicate cases do not establish coverage', () => {
  for (const status of [
    'skipped',
    'todo',
    'failed',
    'interrupted',
  ]) {
    const failed = reports()
    for (const report of failed) {
      report.cases.forEach((entry) => {
        entry.status = status
      })
    }
    assert.ok(!assessContracts([contract], failed, runId, source).passed)
  }
  const retried = reports()
  for (const report of retried) {
    report.cases.forEach((entry) => {
      entry.retry = 1
    })
  }
  assert.ok(!assessContracts([contract], retried, runId, source).passed)
  const duplicate = reports()
  duplicate.push(...reports())
  assert.ok(!assessContracts([contract], duplicate, runId, source).passed)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a primary layer without evidence and duplicate contract IDs fail explicitly', () => {
  assert.ok(!assessContracts([
    { ...contract, unit: [] },
  ], reports(), runId, source).passed)
  assert.throws(() => assessContracts([contract, contract], reports(), runId, source), /unique/)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
