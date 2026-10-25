import type { FullConfig, FullResult, Suite, TestCase, TestResult } from '@playwright/test/reporter'
import type { LayerEvidence } from '~/tests/contracts/types'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import { layerEvidenceSchema } from '~/tests/contracts/schema'

async function evidenceFiles(directory: string, pattern: RegExp): Promise<LayerEvidence[]> {
  const names = (await readdir(directory)).filter(name => pattern.test(name))
  return await Promise.all(names.map(async name =>
    layerEvidenceSchema.parse(JSON.parse(await readFile(path.join(directory, name), 'utf8')))))
}

function singleReport(reports: readonly LayerEvidence[]): LayerEvidence {
  const report = reports[0]
  assert.ok(report !== undefined, 'the invocation wrote no evidence file')
  return report
}

/* eslint-disable ts/no-unsafe-type-assertion -- Playwright builds the reporter
   objects; the probe only needs the fields the reporter reads. */
function browserSuite(names: readonly string[]): Suite {
  const suites = names.map(name => ({
    type: 'project',
    title: name,
    project: () => ({ name }),
  }))
  return { type: 'root', title: '', suites } as unknown as Suite
}

function browserCase(project: string, describes: readonly string[], title: string): TestCase {
  let parent = { type: 'project', title: project, project: () => ({ name: project }) } as unknown as Suite
  for (const describe of describes) {
    parent = { type: 'describe', title: describe, parent, project: () => ({ name: project }) } as unknown as Suite
  }
  return {
    title,
    parent,
    location: { file: path.join(process.cwd(), 'tests/components/specs/probe.spec.ts') },
    annotations: [],
  } as unknown as TestCase
}

async function browserRun(
  projects: readonly string[],
  cases: readonly TestCase[],
  status: string,
  options: { begin?: boolean, layer?: 'e2e' | 'component', caseStatus?: string } = {},
): Promise<void> {
  const { default: ContractReporter } = await import('../support/verification/browser-reporter')
  const reporter = new ContractReporter({ layer: options.layer ?? 'e2e' })
  if (options.begin !== false) {
    reporter.onBegin({} as unknown as FullConfig, browserSuite(projects))
  }
  for (const testCase of cases) {
    reporter.onTestEnd(testCase, { status: options.caseStatus ?? status, retry: 0 } as unknown as TestResult)
  }
  await reporter.onEnd({ status } as unknown as FullResult)
}
/* eslint-enable ts/no-unsafe-type-assertion */

test('browser evidence is immutable and absent or skipped functional cases fail closed', async (t) => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'blog-native-browser-'))
  t.after(async () => await rm(workspace, { recursive: true, force: true }))
  process.env.TMPDIR = workspace
  process.env.BLOG_VERIFICATION_RUN_ID = 'integrity'
  process.env.BLOG_TEST_RUN_ID = 'browser-probe'
  const proofs = path.join(workspace, 'blog-tests/integrity/proofs')
  const browserEvidence = /^e2e-browser-probe-[\w-]+\.json$/
  await browserRun(['chromium', 'webkit'], [
    browserCase('chromium', [], 'top level case'),
    browserCase('webkit', ['accessibility scanner'], 'nested case'),
  ], 'passed')
  const afterPassing = await evidenceFiles(proofs, browserEvidence)
  assert.equal(afterPassing.length, 1)
  const passed = singleReport(afterPassing)
  assert.equal(passed.complete, true)
  const observed = passed.cases.map(entry =>
    `${entry.project ?? ''} :: ${entry.title} :: ${entry.describe.join('/')}`)
  const expected = ['chromium :: top level case :: ', 'webkit :: nested case :: accessibility scanner'] as const
  assert.ok(JSON.stringify(observed) === JSON.stringify(expected))
  await browserRun(['chromium', 'webkit'], [], 'passed')
  const afterEmpty = await evidenceFiles(proofs, browserEvidence)
  assert.equal(afterEmpty.length, 2, 'an empty functional invocation adds failure evidence')
  assert.ok(afterEmpty.some(report => report.complete), 'the earlier passing report stays')
  const emptyReports = afterEmpty.filter(report => !report.complete)
  assert.equal(emptyReports.length, 1)
  assert.equal(emptyReports[0]?.cases.length, 0)
  const performanceCase = browserCase('performance', [], 'performance case')
  await browserRun(['performance'], [performanceCase], 'passed')
  assert.equal((await evidenceFiles(proofs, browserEvidence)).length, 2, 'performance-only writes no e2e report')
  await browserRun([], [], 'failed', { begin: false })
  const afterDiscoveryFailure = await evidenceFiles(proofs, browserEvidence)
  assert.equal(afterDiscoveryFailure.length, 3, 'a failure before onBegin must not disappear')
  assert.equal(afterDiscoveryFailure.filter(report => !report.complete).length, 2)
  await browserRun(['chromium'], [
    browserCase('chromium', [], 'skipped font probe'),
  ], 'passed', {
    layer: 'component',
    caseStatus: 'skipped',
  })
  const components = await evidenceFiles(proofs, /^component-browser-probe-[\w-]+\.json$/)
  assert.equal(singleReport(components).complete, false, 'component suites have no approved skip exemptions')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
