import type { Evidence } from '~/tests/support/browser/control-evidence'
import { test } from 'node:test'
import { fileEvidence } from '~/tests/support/browser/control-evidence'
import { equal } from '~/tests/support/unit/assertions'

const file = 'tests/browser/editor/tables/table-drag.spec.ts'
const title = 'long press row handle reorders and stays usable'
const reason = 'Chromium CDP drives physical touch; mouse coverage runs on all browsers.'

function evidence(fields: Partial<Evidence> = {}): Evidence {
  return {
    file,
    project: 'webkit',
    title: 'pointer regression',
    caseTitle: 'pointer regression',
    checkpoints: ['pointer regression'],
    status: 'passed',
    retry: 0,
    annotations: [],
    ...fields,
  }
}

function physical(): Evidence {
  return evidence({ caseTitle: title, status: 'skipped', annotations: [
    { type: 'skip', description: reason },
  ] })
}

test('control evidence requires executed, passing cases for each browser', () => {
  const results = [
    evidence(),
  ]
  equal(fileEvidence(results, file, 'webkit').passed, true)
  equal(fileEvidence(results, file, 'chromium').passed, false)
  equal(fileEvidence([
    evidence({ status: 'skipped' }),
  ], file, 'webkit').passed, false)
}).catch((error: unknown) => { throw error })

test('an exact CDP-only skip requires its passing Chromium counterpart and applicable WebKit evidence', () => {
  const results = [
    evidence(),
    physical(),
    evidence({ project: 'chromium', caseTitle: title }),
  ]
  const report = fileEvidence(results, file, 'webkit')
  equal(report.passed, true)
  equal(report.tests.find(item => item.caseTitle === title)?.excluded, true)
  equal(report.tests.find(item => item.caseTitle === title)?.platformLimitation, reason)
}).catch((error: unknown) => { throw error })

test('CDP-only skips cannot substitute for applicable WebKit tests', () => {
  const results = [
    physical(),
    evidence({ project: 'chromium', caseTitle: title }),
  ]
  equal(fileEvidence(results, file, 'webkit').passed, false)
}).catch((error: unknown) => { throw error })

test('missing, failed or retried Chromium counterparts leave the skip uncovered', () => {
  for (const counterpart of [
    [],
    [
      evidence({ project: 'chromium', caseTitle: title, status: 'failed' }),
    ],
    [
      evidence({ project: 'chromium', caseTitle: title, retry: 1 }),
    ],
  ]) {
    equal(fileEvidence([
      evidence(),
      physical(),
      ...counterpart,
    ], file, 'webkit').passed, false)
  }
}).catch((error: unknown) => { throw error })

test('CDP annotations on another file or another case do not authorize exclusions', () => {
  const chromium = evidence({ project: 'chromium', caseTitle: title })
  const wrongFile = 'tests/browser/unrelated.spec.ts'
  const result = fileEvidence([
    evidence({ file: wrongFile }),
    { ...physical(), file: wrongFile },
    { ...chromium, file: wrongFile },
  ], wrongFile, 'webkit')
  equal(result.passed, false)
  equal(fileEvidence([
    evidence(),
    { ...physical(), caseTitle: 'another case' },
    chromium,
  ], file, 'webkit').passed, false)
}).catch((error: unknown) => { throw error })

test('changed or missing skip reasons are not accepted as platform limitations', () => {
  for (const annotations of [
    [],
    [
      { type: 'skip', description: 'New unsupported behavior' },
    ],
  ]) {
    equal(fileEvidence([
      evidence(),
      { ...physical(), annotations },
      evidence({ project: 'chromium', caseTitle: title }),
    ], file, 'webkit').passed, false)
  }
}).catch((error: unknown) => { throw error })

test('a failed CDP-annotated WebKit case is never excluded', () => {
  equal(fileEvidence([
    evidence(),
    { ...physical(), status: 'failed' },
    evidence({ project: 'chromium', caseTitle: title }),
  ], file, 'webkit').passed, false)
}).catch((error: unknown) => { throw error })

test('retried passing cases do not satisfy control evidence', () => {
  equal(fileEvidence([
    evidence({ retry: 1 }),
  ], file, 'webkit').passed, false)
}).catch((error: unknown) => { throw error })
