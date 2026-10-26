import type { TestModule, Vitest } from 'vitest/node'
import type { CaseEvidence } from '~/tests/contracts/types'
import type { DomEvidenceInput, NativeReport } from '~/tests/support/verification/dom-evidence'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import { layerEvidenceSchema } from '~/tests/contracts/schema'
import {
  buildDomEvidence,
  domReceiptSchema,
  domRunId,
  readNativeReport,
} from '~/tests/support/verification/dom-evidence'
import { sourceIdentity } from '~/tests/support/verification/source'

/*
 * The jsdom layer's own evidence rules, judged with synthetic inputs:
 * which invocation may claim a prepared batch, what an exit status cannot say,
 * and whether Vitest's own report agrees with the receipt.
 */

const preparedA = { id: '11111111-1111-4111-8111-111111111111', revision: 'rev-a', fingerprint: 'fp-a' }
const preparedB = { id: '22222222-2222-4222-8222-222222222222', revision: 'rev-a', fingerprint: 'fp-a' }
const source = { revision: 'rev-a', fingerprint: 'fp-a' }
const domFile = 'tests/dom/history-page-model.test.tsx'
const passedCase: CaseEvidence = { file: domFile, title: 'a case', describe: [], status: 'passed', retry: 0 }

function nativeReport(cases: readonly { file: string, title: string, status?: string }[] = [
  { file: domFile, title: 'a case' },
]): NativeReport {
  return {
    file: 'dom/probe-vitest.json',
    total: cases.length,
    passed: cases.filter(entry => (entry.status ?? 'passed') === 'passed').length,
    failed: cases.filter(entry => entry.status === 'failed').length,
    pending: cases.filter(entry => entry.status === 'skipped' || entry.status === 'pending').length,
    cases: cases.map(entry => ({
      file: entry.file,
      describe: [],
      title: entry.title,
      status: entry.status ?? 'passed',
    })),
  }
}

function input(overrides: Partial<DomEvidenceInput> = {}): DomEvidenceInput {
  return {
    invocation: randomUUID(),
    evidenceFile: 'proofs/dom-probe.json',
    tool: { version: '5.0.5', environment: 'jsdom' },
    startedAt: new Date(1000),
    endedAt: new Date(2000),
    reason: 'passed',
    unhandledErrors: [],
    cases: [passedCase],
    preparedAtStart: preparedA,
    preparedAtEnd: preparedA,
    sourceAtStart: source,
    sourceAtEnd: source,
    native: nativeReport(),
    nativeIssues: [],
    ...overrides,
  }
}

test('one stable manifest makes a same-batch jsdom result', () => {
  const built = buildDomEvidence(input())
  assert.equal(built.evidence.layer, 'dom')
  assert.equal(built.evidence.runId, preparedA.id)
  assert.equal(built.evidence.complete, true)
  const [only] = built.evidence.cases
  assert.ok(only !== undefined, 'the receipt recorded no case')
  assert.equal(only.file, domFile)
  assert.equal(only.status, 'passed')
  layerEvidenceSchema.parse(built.evidence)
  const receipt = built.receipt
  assert.equal(receipt.tool.environment, 'jsdom')
  assert.equal(receipt.nativeReport?.file, 'dom/probe-vitest.json')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a manifest replaced by a parallel prepare leaves the run out of every batch', () => {
  const replaced = buildDomEvidence(input({ preparedAtEnd: preparedB }))
  assert.equal(replaced.evidence.runId, null, 'the invocation must not borrow either batch')
  assert.equal(replaced.evidence.complete, false)
  assert.ok(replaced.problems.some(problem => /replaced/.test(problem)))
  assert.equal(buildDomEvidence(input({ preparedAtEnd: null })).evidence.runId, null)
  assert.equal(buildDomEvidence(input({ preparedAtStart: null, preparedAtEnd: null })).evidence.runId, null)
  const standalone = buildDomEvidence(input({ preparedAtStart: null, preparedAtEnd: null }))
  assert.ok(standalone.problems.some(problem => /standalone/.test(problem)))
  assert.equal(standalone.evidence.complete, false, 'a standalone run cannot claim a batch result')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('a run id is only granted when the manifest belongs to the executed source', () => {
  const otherSource = { revision: 'rev-b', fingerprint: 'fp-b' }
  assert.equal(domRunId(input({ preparedAtEnd: preparedB })), null)
  assert.equal(domRunId(input({ preparedAtStart: preparedB })), null, 'a manifest of another source is not a batch')
  const moved = buildDomEvidence(input({ sourceAtEnd: otherSource }))
  assert.equal(moved.evidence.complete, false)
  assert.ok(moved.problems.some(problem => /source changed/.test(problem)))
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('failure, skip, retry, an empty run and a wandering error are all incomplete', () => {
  const cases: Record<string, Partial<DomEvidenceInput>> = {
    failure: { reason: 'failed' },
    skip: { cases: [
      { ...passedCase, status: 'skipped', retry: 0 },
    ], native: nativeReport([
      { file: domFile, title: 'a case', status: 'skipped' },
    ]) },
    retry: { cases: [
      { ...passedCase, retry: 2 },
    ] },
    zero: { cases: [], native: nativeReport([]) },
    unhandled: { unhandledErrors: ['boom'] },
  }
  for (const [name, overrides] of Object.entries(cases)) {
    assert.equal(buildDomEvidence(input(overrides)).evidence.complete, false, `${name} must not pass`)
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('the retained native report has to name the same cases as the receipt', () => {
  const silent = buildDomEvidence(input({ native: null }))
  assert.equal(silent.evidence.complete, false, 'a report that was never read is not a receipt')
  const missing = buildDomEvidence(input({ native: null, nativeIssues: ['the native Vitest report is missing'] }))
  assert.equal(missing.evidence.complete, false)
  assert.match(missing.problems.join(' '), /missing/)
  const divergent = buildDomEvidence(input({ native: nativeReport([
    { file: domFile, title: 'another case' },
  ]) }))
  assert.equal(divergent.evidence.complete, false)
  assert.match(divergent.problems.join(' '), /does not list the same cases/)
  const short = buildDomEvidence(input({ native: { ...nativeReport(), total: 3 } }))
  assert.equal(short.evidence.complete, false, 'a count mismatch is not explainable away')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

test('the native report reader keeps ancestors, files and refusals explicit', () => {
  const parsed = readNativeReport(JSON.stringify({
    numTotalTests: 2,
    numPassedTests: 1,
    numFailedTests: 1,
    numPendingTests: 0,
    testResults: [
      {
        name: path.join(process.cwd(), domFile),
        assertionResults: [
          { ancestorTitles: [], title: 'top', status: 'passed' },
          { ancestorTitles: ['suite'], title: 'nested', status: 'failed' },
        ],
      },
    ],
  }), { file: 'dom/x-vitest.json', root: process.cwd() })
  assert.deepEqual(parsed.cases, [
    { file: domFile, describe: [], title: 'top', status: 'passed' },
    { file: domFile, describe: ['suite'], title: 'nested', status: 'failed' },
  ])
  assert.throws(() => readNativeReport('not json', { file: 'x', root: process.cwd() }))
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))

function vitestCase(title: string, asDescribe: readonly string[] = []): unknown {
  let parent: Record<string, unknown> = { type: 'module', name: '', parent: undefined }
  for (const name of asDescribe) {
    parent = { type: 'suite', name, parent }
  }
  return {
    name: title,
    parent,
    module: { moduleId: path.join(process.cwd(), domFile) },
    result: () => ({ state: 'passed' }),
    diagnostic: () => ({ retryCount: 0, duration: 5 }),
  }
}

function module(cases: readonly unknown[]): unknown {
  return { children: { allTests: () => cases } }
}

test('the reporter binds the batch it started in and retains Vitest\'s own report', async (t) => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'blog-native-dom-'))
  t.after(async () => await rm(workspace, { recursive: true, force: true }))
  process.env.TMPDIR = workspace
  process.env.BLOG_VERIFICATION_RUN_ID = 'dom-probe'
  delete process.env.BLOG_TEST_RUN_ID
  // The manifest must name the source the reporter itself will read from disk.
  const run = { id: preparedA.id, ...sourceIdentity() }
  const proofs = path.join(workspace, 'blog-tests/dom-probe/proofs')
  const artifacts = path.join(workspace, 'blog-tests/dom-probe/dom')
  await mkdir(proofs, { recursive: true })
  await writeFile(path.join(proofs, 'run.json'), JSON.stringify(run))
  const invocation = randomUUID()
  const nativeFile = path.join(artifacts, `${invocation}-vitest.json`)
  await mkdir(artifacts, { recursive: true })
  await writeFile(nativeFile, JSON.stringify({
    numTotalTests: 1,
    numPassedTests: 1,
    numFailedTests: 0,
    numPendingTests: 0,
    testResults: [
      { name: path.join(process.cwd(), domFile), assertionResults: [
        { ancestorTitles: [], title: 'a case', status: 'passed' },
      ] },
    ],
  }))
  process.env.BLOG_DOM_INVOCATION = invocation
  process.env.BLOG_DOM_NATIVE_REPORT = nativeFile
  const { default: DomReporter } = await import('../support/verification/dom-reporter')
  /* eslint-disable ts/no-unsafe-type-assertion -- Vitest builds these reporter
     objects; the probe only needs the fields the reporter reads. */
  const reporter = new DomReporter()
  reporter.onInit({ version: '5.0.5', config: { environment: 'jsdom' } } as unknown as Vitest)
  await reporter.onTestRunEnd([
    module([
      vitestCase('a case'),
    ]),
  ] as unknown as TestModule[], [], 'passed')
  const files = (await readdir(proofs)).filter(name => /^dom-[\w-]+\.json$/.test(name))
  assert.equal(files.length, 1)
  const raw = await readFile(path.join(proofs, files[0] ?? ''), 'utf8')
  const evidence = layerEvidenceSchema.parse(JSON.parse(raw))
  assert.equal(raw.includes('"project"'), false, 'a jsdom proof never names a browser project')
  assert.equal(evidence.runId, preparedA.id)
  assert.equal(evidence.complete, true)
  const receipt = domReceiptSchema.parse(JSON.parse(await readFile(path.join(artifacts, `${invocation}.json`), 'utf8')))
  assert.equal(receipt.nativeReport?.file, `dom/${invocation}-vitest.json`)
  assert.equal(receipt.prepared.runId, preparedA.id)
  // A later invocation in the same prepared run keeps its own proof file: a
  // passing retry cannot replace the earlier evidence.
  const second = randomUUID()
  await writeFile(path.join(artifacts, `${second}-vitest.json`), await readFile(nativeFile, 'utf8'))
  process.env.BLOG_DOM_INVOCATION = second
  process.env.BLOG_DOM_NATIVE_REPORT = path.join(artifacts, `${second}-vitest.json`)
  const retry = new DomReporter()
  retry.onInit({ version: '5.0.5', config: { environment: 'jsdom' } } as unknown as Vitest)
  await retry.onTestRunEnd([
    module([
      vitestCase('a case'),
    ]),
  ] as unknown as TestModule[], [], 'passed')
  assert.equal((await readdir(proofs)).filter(name => /^dom-[\w-]+\.json$/.test(name)).length, 2)
  /* eslint-enable ts/no-unsafe-type-assertion */
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
