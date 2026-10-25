import type { BrowserReference, LayerEvidence } from '~/tests/contracts/types'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assessNativePlan } from '~/tests/contracts/legacy'

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
