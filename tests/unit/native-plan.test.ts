import type { BrowserReference, LayerEvidence } from '~/tests/contracts/types'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assessNativePlan } from '~/tests/contracts/legacy'
import { controls } from '~/tests/support/browser/control-contract'

const plan: BrowserReference[] = [
  { file: 'tests/browser/example.spec.ts', title: 'required', projects: ['chromium', 'webkit'] },
]
const report: LayerEvidence = {
  schemaVersion: 1,
  layer: 'e2e',
  runId: null,
  source: { revision: 'example', fingerprint: 'example' },
  complete: true,
  cases: (['chromium', 'webkit'] as const).map(project => ({
    file: 'tests/browser/example.spec.ts',
    title: 'required',
    project,
    describe: [],
    status: 'passed',
    retry: 0,
  })),
}

test('native discovery requires every exact identity once, not an arbitrary passing case per file', () => {
  assert.deepEqual(assessNativePlan([report], plan), [])
  assert.ok(assessNativePlan([
    { ...report, cases: report.cases.slice(0, 1) },
  ], plan).length > 0)
  assert.ok(assessNativePlan([report, report], plan).length > 0)
  assert.ok(assessNativePlan([
    {
      ...report,
      cases: report.cases.map(entry => ({ ...entry, title: 'invented' })),
    },
  ], plan).length > 0)
  assert.ok(assessNativePlan([
    {
      ...report,
      cases: report.cases.map(entry => ({ ...entry, describe: ['different scope'] })),
    },
  ], plan).length > 0)
  assert.ok(assessNativePlan([report], []).length > 0)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('component replacements remain complete native obligations alongside retained E2E', () => {
  const file = 'tests/components/specs/example.spec.ts'
  const component: LayerEvidence = {
    ...report,
    layer: 'component',
    cases: report.cases.map(entry => ({ ...entry, file })),
  }
  const expected = [
    ...plan,
    ...plan.map(reference => ({ ...reference, file })),
  ]
  assert.deepEqual(assessNativePlan([report, component], expected), [])
  assert.ok(assessNativePlan([report], expected).length > 0)
  const [control] = controls('example', [file], ['ready'], [
    ['button', 'activates'],
  ])
  assert.deepEqual(control?.evidence, [file])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
