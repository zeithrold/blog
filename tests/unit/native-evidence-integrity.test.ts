import type { CaseEvidence, Layer, LayerEvidence, NodeReference, VerificationContract } from '~/tests/contracts/types'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import { assessContracts } from '~/tests/contracts/assess'
import { layerEvidenceSchema } from '~/tests/contracts/schema'

const runId = randomUUID()
const source = { revision: 'probe-revision', fingerprint: 'probe-fingerprint' }
const nativeEvidence = /^unit-[\w-]+\.json$/

async function proofRoot(prefix: string): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), prefix))
}

function singleReport(reports: readonly LayerEvidence[]): LayerEvidence {
  const report = reports[0]
  if (report === undefined) {
    assert.fail('the invocation wrote no evidence file')
  }
  return report
}

async function namesIn(directory: string): Promise<string[]> {
  try {
    return await readdir(directory)
  }
  catch {
    return []
  }
}

async function evidenceFiles(directory: string, pattern: RegExp): Promise<LayerEvidence[]> {
  const names = (await namesIn(directory)).filter(name => pattern.test(name))
  return await Promise.all(names.map(async name =>
    layerEvidenceSchema.parse(JSON.parse(await readFile(path.join(directory, name), 'utf8')))))
}

/**
 * Run the native node:test reporter over fixtures belonging to one prepared run,
 * so a second call evidences a rerun in that run rather than a fresh one.
 */
async function invoke(
  root: string,
  run: string,
  fixtures: Record<string, string>,
): Promise<{ status: number | null, reports: LayerEvidence[] }> {
  const sources = path.join(root, 'fixtures')
  await mkdir(sources, { recursive: true })
  const files: string[] = []
  for (const [name, body] of Object.entries(fixtures)) {
    const file = path.join(sources, name)
    await writeFile(file, body)
    files.push(file)
  }
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    TMPDIR: root,
    BLOG_TEST_LAYER: 'unit',
    BLOG_VERIFICATION_RUN_ID: run,
  }
  delete environment.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, [
    '--test',
    '--test-concurrency=2',
    '--test-reporter=./tests/support/verification/node-reporter.ts',
    ...files,
  ], {
    encoding: 'utf8',
    env: environment,
  })
  return {
    status: result.status,
    reports: await evidenceFiles(path.join(root, 'blog-tests', run, 'proofs'), nativeEvidence),
  }
}

function label(entry: CaseEvidence): string {
  return `${path.basename(entry.file)} :: ${entry.title} :: ${entry.describe.join('/')}`
}

function unitContract(id: string, reference: NodeReference): VerificationContract {
  return {
    id,
    behavior: `Probe: ${id}`,
    primary: 'unit',
    unit: [reference],
    integration: [],
    dom: [],
    component: [],
    e2e: [],
    dimensions: ['validation'],
    rationale: `Probe rationale for ${id}; only the cited native case may prove it.`,
  }
}

function citedAs(reports: readonly LayerEvidence[], file: string): LayerEvidence[] {
  return reports.map(report => ({
    ...report,
    runId,
    source,
    cases: report.cases.map(entry => ({ ...entry, file })),
  }))
}

function evidence(layer: Layer, cases: CaseEvidence[]): LayerEvidence {
  return { schemaVersion: 1, layer, runId, source, complete: true, cases }
}

test('native ancestry survives nested describes and subtests of concurrent files', async (t) => {
  const root = await proofRoot('blog-native-ancestry-')
  t.after(async () => await rm(root, { recursive: true, force: true }))
  const { status, reports } = await invoke(root, randomUUID(), {
    'first.fixture.mjs': `
      import { describe, test } from 'node:test'
      test('top level', () => {})
      describe('outer', () => {
        test('nested', () => {})
        describe('inner', () => {
          test('deep', () => {})
        })
      })
      test('parent with child', async (t) => {
        await t.test('required child', () => {})
      })
    `,
    'second.fixture.mjs': `
      import { describe, test } from 'node:test'
      describe('other', () => {
        test('deep', () => {})
      })
    `,
  })
  assert.equal(status, 0)
  const report = singleReport(reports)
  assert.equal(report.complete, true)
  const observed = report.cases.map(label).sort((left, right) => left.localeCompare(right))
  assert.deepEqual(observed, [
    'first.fixture.mjs :: deep :: outer/inner',
    'first.fixture.mjs :: nested :: outer',
    'first.fixture.mjs :: parent with child :: ',
    'first.fixture.mjs :: required child :: parent with child',
    'first.fixture.mjs :: top level :: ',
    'second.fixture.mjs :: deep :: other',
  ] as const)
  const helper = await invoke(root, randomUUID(), {
    'parent.fixture.mjs': `
      import { test } from 'node:test'
      import { child } from './helper.mjs'
      test('parent', async t => await child(t))
    `,
    'helper.mjs': 'export async function child(t) { await t.test("helper child", () => {}) }',
  })
  assert.equal(helper.status, 0)
  const helperReport = singleReport(helper.reports)
  assert.equal(helperReport.complete, true)
  assert.deepEqual(helperReport.cases.find(entry => entry.title === 'helper child')?.describe, ['parent'])
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a skipped native subtest leaves the layer incomplete so its parent cannot prove a contract', async (t) => {
  const root = await proofRoot('blog-native-skip-')
  t.after(async () => await rm(root, { recursive: true, force: true }))
  const { status, reports } = await invoke(root, randomUUID(), {
    'skip.fixture.mjs': `
      import { test } from 'node:test'
      test('parent with a required child', async (t) => {
        await t.test('required child', { skip: 'probe skip' }, () => {})
      })
    `,
  })
  assert.equal(status, 0)
  const report = singleReport(reports)
  const observed = report.cases.map(label).sort((left, right) => left.localeCompare(right))
  assert.deepEqual(observed, [
    'skip.fixture.mjs :: parent with a required child :: ',
    'skip.fixture.mjs :: required child :: parent with a required child',
  ] as const)
  const statuses = report.cases.map(entry => entry.status)
  // A subtest finishes before the parent it belongs to.
  assert.deepEqual(statuses, ['skipped', 'passed'] as const)
  assert.equal(report.complete, false)
  const contract = unitContract('probe.parent', {
    file: 'tests/unit/native-probe.test.ts',
    title: 'parent with a required child',
  })
  const cited = citedAs(reports, 'tests/unit/native-probe.test.ts')
  const positive = cited.map(entry => ({
    ...entry,
    complete: true,
    cases: entry.cases.filter(result => result.status === 'passed'),
  }))
  assert.equal(assessContracts([contract], positive, runId, source).passed, true)
  const assessment = assessContracts([contract], cited, runId, source)
  assert.equal(assessment.passed, false)
  assert.match(assessment.issues[0]?.reason ?? '', /incomplete/)
  const suite = await invoke(root, randomUUID(), {
    'skip-suite.fixture.mjs': `
      import { describe, test } from 'node:test'
      test('good', () => {})
      describe('skipped suite', { skip: true }, () => { test('hidden', () => {}) })
    `,
  })
  assert.equal(suite.status, 0)
  assert.equal(singleReport(suite.reports).complete, false, 'a skipped suite emits no child cases')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('native invocation files stay immutable inside one prepared run', async (t) => {
  const root = await proofRoot('blog-native-rerun-')
  t.after(async () => await rm(root, { recursive: true, force: true }))
  const run = randomUUID()
  const failure = await invoke(root, run, {
    'cited.fixture.mjs': `
      import { test } from 'node:test'
      test('cited case', () => { throw new Error('probe failure') })
    `,
  })
  assert.equal(failure.status, 1)
  assert.equal(failure.reports.filter(report => !report.complete).length, 1)
  const rerun = await invoke(root, run, {
    'cited.fixture.mjs': `
      import { test } from 'node:test'
      test('cited case', () => {})
    `,
  })
  assert.equal(rerun.status, 0)
  assert.equal(rerun.reports.length, 2, 'a rerun adds a file instead of replacing the failure')
  assert.ok(rerun.reports.some(report => report.complete))
  assert.ok(rerun.reports.some(report => report.cases.some(entry =>
    entry.title === 'cited case' && entry.status === 'failed')))
  const contract = unitContract('probe.rerun', { file: 'tests/unit/cited.test.ts', title: 'cited case' })
  const positive = citedAs(rerun.reports.filter(report => report.complete), 'tests/unit/cited.test.ts')
  assert.equal(assessContracts([contract], positive, runId, source).passed, true)
  const assessed = assessContracts([contract], citedAs(rerun.reports, 'tests/unit/cited.test.ts'), runId, source)
  assert.equal(assessed.passed, false)
  assert.match(assessed.issues[0]?.reason ?? '', /incomplete/)
  // A success followed by an invocation that executes nothing records failure
  // evidence for the layer instead of leaving the earlier pass standing.
  const empty = await invoke(root, run, { 'empty.fixture.mjs': 'export const nothing = true' })
  assert.equal(empty.status, 0)
  assert.equal(empty.reports.length, 3)
  const zeroCase = empty.reports.filter(report => report.cases.length === 0)
  assert.equal(zeroCase.length, 1)
  assert.equal(zeroCase[0]?.complete, false)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('an omitted describe means a top-level case, not any nesting', () => {
  const topLevel: CaseEvidence = {
    file: 'tests/unit/native.test.ts',
    title: 'shared title',
    describe: [],
    status: 'passed',
    retry: 0,
  }
  const nested: CaseEvidence = {
    file: 'tests/unit/native.test.ts',
    title: 'shared title',
    describe: ['suite'],
    status: 'passed',
    retry: 0,
  }
  const topLevelOnly = unitContract('probe.ancestry', {
    file: 'tests/unit/native.test.ts',
    title: 'shared title',
  })
  const nestedEvidence = evidence('unit', [nested])
  const topLevelEvidence = evidence('unit', [topLevel])
  const nestedReported = assessContracts([topLevelOnly], [nestedEvidence], runId, source)
  assert.equal(nestedReported.passed, false)
  assert.match(nestedReported.issues[0]?.reason ?? '', /no executed case/)
  assert.equal(assessContracts([topLevelOnly], [topLevelEvidence], runId, source).passed, true)
  const nestedCited = unitContract('probe.ancestry-nested', {
    file: 'tests/unit/native.test.ts',
    title: 'shared title',
    describe: ['suite'],
  })
  assert.equal(assessContracts([nestedCited], [nestedEvidence], runId, source).passed, true)
  assert.equal(assessContracts([nestedCited], [topLevelEvidence], runId, source).passed, false)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
