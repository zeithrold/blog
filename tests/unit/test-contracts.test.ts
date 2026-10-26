import type { LayerEvidence, VerificationContract } from '~/tests/contracts/types'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assessContracts, assessDomPlan } from '~/tests/contracts/assess'
import { contractSchema } from '~/tests/contracts/schema'

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
  dom: [],
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

/*
 * The jsdom layer is a native layer, not a browser: these fixtures are synthetic
 * so the rules are judged here rather than by whichever DOM cases exist today.
 */
const domFile = 'tests/dom/probe.test.tsx'
const domContract: VerificationContract = {
  id: 'probe.dom-layer',
  behavior: 'A jsdom case proves the client contract without an engine',
  primary: 'dom',
  unit: [],
  integration: [],
  dom: [
    { file: domFile, title: 'jsdom probe' },
  ],
  component: [],
  e2e: [],
  dimensions: ['client-state'],
  rationale: 'Synthetic fixture for the dom layer rules.',
}

function domReport(cases: LayerEvidence['cases'], overrides: Partial<LayerEvidence> = {}): LayerEvidence {
  return {
    schemaVersion: 1,
    layer: 'dom',
    runId,
    source,
    complete: true,
    cases,
    ...overrides,
  }
}

const domCase = { file: domFile, title: 'jsdom probe', describe: [], status: 'passed', retry: 0 }

test('a DOM rule is proved by one exact jsdom case and never by a browser engine', () => {
  assert.ok(assessContracts([domContract], [
    domReport([domCase]),
  ], runId, source).passed)
  for (const project of ['chromium', 'webkit'] as const) {
    const disguised = domReport([
      { ...domCase, project },
    ])
    const assessed = assessContracts([domContract], [disguised], runId, source)
    assert.ok(!assessed.passed, `a ${project} result must not answer for jsdom`)
    assert.match(assessed.issues[0]?.reason ?? '', /no executed case/)
  }
  for (const mutation of [
    { status: 'skipped' },
    { status: 'pending' },
    { retry: 1 },
  ]) {
    const assessed = assessContracts([domContract], [
      domReport([
        { ...domCase, ...mutation },
      ]),
    ], runId, source)
    assert.ok(!assessed.passed, `a case that did not pass first time must not prove: ${mutation.status ?? ''}`)
  }
  const duplicated = assessContracts([domContract], [
    domReport([domCase, domCase]),
  ], runId, source)
  assert.ok(!duplicated.passed, 'two executions in one run are not one result')
  const stale = assessContracts([domContract], [
    domReport([domCase], { runId: null }),
  ], runId, source)
  assert.ok(!stale.passed, 'a standalone run cannot lend batch evidence')
  const moved = assessContracts(
    [domContract],
    [
      domReport([domCase], { source: { ...source, fingerprint: 'moved' } }),
    ],
    runId,
    source,
  )
  assert.ok(!moved.passed, 'another source is not this source')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('DOM references and evidence are strict about what a jsdom case is', () => {
  assert.throws(() => contractSchema.parse({ ...domContract, dom: [
    { file: 'tests/browser/x.spec.ts', title: 'x' },
  ] }))
  assert.throws(() => contractSchema.parse({ ...domContract, dom: [
    { file: domFile, title: 'x', projects: ['chromium'] },
  ] }))
  assert.throws(() => assessContracts(
    [domContract],
    [
      { ...domReport([domCase]), cases: [
        { title: 'no file' },
      ] },
    ],
    runId,
    source,
  ), 'malformed evidence must not be read as coverage')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a complete DOM report cannot stand in for jsdom case facts', () => {
  const plan = [
    { file: domFile, title: 'jsdom probe', describe: [] },
  ]
  // `complete: true` is exactly what a broken or forged proof would claim, so the
  // plan obligation reads the cases themselves: no engine, passed, not retried.
  for (const [mutation, expected] of [
    [
      { project: 'chromium' },
      /names no browser project \(chromium\)/,
    ],
    [
      { project: 'webkit' },
      /names no browser project \(webkit\)/,
    ],
    [
      { status: 'skipped' },
      /jsdom probe: skipped/,
    ],
    [
      { status: 'pending' },
      /jsdom probe: pending/,
    ],
    [
      { retry: 1 },
      /passed only after 1 attempt/,
    ],
  ] as const) {
    const issues = assessDomPlan([
      domReport([
        { ...domCase, ...mutation },
      ]),
    ], plan, { runId, source })
    assert.match(issues.join(' '), expected)
    assert.equal(issues.length > 0, true)
  }
  // A valid case still proves the plan, and only a valid one counts as an execution.
  assert.deepEqual(assessDomPlan([
    domReport([
      { ...domCase, project: 'chromium' },
    ]),
    domReport([domCase], { runId: '33333333-3333-4333-8333-333333333333' }),
  ], plan, { runId, source }).length > 0, true, 'a browser-labelled case never satisfies a jsdom plan')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('the DOM layer must execute its whole plan, exactly once, in this batch', () => {
  const plan = [
    { file: domFile, title: 'jsdom probe', describe: [] },
  ]
  assert.deepEqual(assessDomPlan([
    domReport([domCase]),
  ], plan, { runId, source }), [])
  const extra = { ...domCase, title: 'unlisted case' }
  assert.match(assessDomPlan([
    domReport([domCase, extra]),
  ], plan, { runId, source })[0] ?? '', /Unexpected DOM execution/)
  assert.match(assessDomPlan([
    domReport([]),
  ], plan, { runId, source })[0] ?? '', /found 0/)
  assert.match(
    assessDomPlan([
      domReport([domCase], { complete: false }),
    ], plan, { runId, source })[0] ?? '',
    /incomplete/,
  )
  // A stale report never proves this batch, and it never stands in for a missing
  // one either: the layer is mandatory for a full batch, cited or not.
  assert.match(
    assessDomPlan([
      domReport([domCase], { runId: null }),
    ], plan, { runId, source })[0] ?? '',
    /Only stale DOM execution reports/,
  )
  assert.match(
    assessDomPlan([], plan, { runId, source })[0] ?? '',
    /No DOM execution report in this batch/,
  )
  assert.match(
    assessDomPlan([
      domReport([domCase], { source: { ...source, fingerprint: 'moved' } }),
    ], plan, { runId, source })[0] ?? '',
    /Only stale DOM execution reports/,
  )
  assert.deepEqual(
    assessDomPlan([
      domReport([domCase]),
      domReport([domCase], { runId: null }),
    ], plan, { runId, source }),
    [],
    'a stale report beside a current one is ignored, not counted twice',
  )
  assert.match(
    assessDomPlan([
      domReport([domCase]),
    ], [], { runId, source })[0] ?? '',
    /nonempty, unique case plan/,
  )
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
