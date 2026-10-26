import type { Reporter, TestCase, TestModule, TestRunEndReason, Vitest } from 'vitest/node'
import type { NativeReport } from './dom-evidence'
import type { CaseEvidence } from '~/tests/contracts/types'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { buildDomEvidence, readNativeReport } from './dom-evidence'
import { currentRun, domArtifactRoot, verificationDirectory, verificationRoot } from './paths'
import { sourceIdentity } from './source'

/*
 * The `dom` layer's reporter: a jsdom probe, never a browser.
 *
 * It writes two artifacts. `proofs/dom-<invocation>.json` is the layer evidence
 * the contract gate reads, in the same shape as the unit, integration and browser
 * layers, so a jsdom case is cited exactly like any other case — and never as a
 * chromium or webkit project. `dom/<invocation>.json` is the tool receipt: the
 * Vitest version, the real environment, the prepared run it was bound to and the
 * name of Vitest's own JSON report, which this reporter reads and cross-checks.
 *
 * Everything the receipt depends on is captured when the invocation starts. The
 * end of the run only confirms it: which batch a result belongs to cannot be
 * decided by looking at the run directory after the fact, because another
 * `test:prepare` may have replaced the manifest in the meantime.
 */
export default class DomReporter implements Reporter {
  private readonly startedAt = new Date()
  private readonly invocation = process.env.BLOG_DOM_INVOCATION ?? randomUUID()
  /** The batch this invocation promises to belong to, read before any test ran. */
  private readonly preparedAtStart = currentRun()
  // Captured when the run is created: the source of the tests that will execute.
  private readonly sourceAtStart = sourceIdentity()
  private version = 'unknown'
  private environment = 'jsdom'

  onInit(vitest: Vitest): void {
    this.version = vitest.version
    this.environment = vitest.config.environment
  }

  async onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<unknown>,
    reason: TestRunEndReason,
  ): Promise<void> {
    const endedAt = new Date()
    // Native case records, executed cases only: a file name alone proves nothing.
    const cases = testModules.flatMap(module =>
      Array.from(module.children.allTests(), testCase => executedCase(testCase)))
    const native = await waitForNativeReport()
    const evidence = buildDomEvidence({
      invocation: this.invocation,
      evidenceFile: path.join('proofs', `dom-${this.invocation}.json`),
      tool: { version: this.version, environment: this.environment },
      startedAt: this.startedAt,
      endedAt,
      reason,
      unhandledErrors: unhandledErrors.map(describeError),
      cases,
      preparedAtStart: this.preparedAtStart,
      preparedAtEnd: currentRun(),
      sourceAtStart: this.sourceAtStart,
      sourceAtEnd: sourceIdentity(),
      ...native,
    })
    // One file per invocation, in two places: a later attempt cannot replace the
    // proof or the receipt an earlier one produced.
    await mkdir(verificationRoot, { recursive: true })
    await mkdir(domArtifactRoot, { recursive: true })
    await writeFile(
      path.join(verificationRoot, `dom-${this.invocation}.json`),
      JSON.stringify(evidence.evidence, null, 2),
    )
    await writeFile(
      path.join(domArtifactRoot, `${this.invocation}.json`),
      JSON.stringify(evidence.receipt, null, 2),
    )
    // The files are the receipt; this makes the same result readable without
    // opening them, including when the system temp directory is ephemeral.
    process.stdout.write([
      '',
      `DOM evidence: ${path.join(verificationRoot, `dom-${this.invocation}.json`)}`,
      `complete: ${String(evidence.evidence.complete)}  cases: ${evidence.evidence.cases.length}`,
      `run: ${evidence.evidence.runId ?? 'unprepared'}`,
      `native report: ${evidence.receipt.nativeReport === null ? 'missing' : 'retained'}`,
      ...evidence.problems.map(problem => `problem: ${problem}`),
      '',
    ].join('\n'))
  }
}

function executedCase(testCase: TestCase): CaseEvidence {
  const diagnostic = testCase.diagnostic()
  return {
    file: path.relative(process.cwd(), testCase.module.moduleId).split(path.sep).join('/'),
    title: testCase.name,
    describe: suiteNames(testCase),
    status: testCase.result().state,
    retry: diagnostic?.retryCount ?? 0,
  }
}

function suiteNames(testCase: TestCase): string[] {
  const names: string[] = []
  let parent = testCase.parent
  while (parent.type === 'suite') {
    names.unshift(parent.name)
    parent = parent.parent
  }
  return names
}

/**
 * Vitest writes its own JSON report in the same hook this reporter runs in, and
 * the hooks run concurrently. Wait for the file instead of assuming an ordering:
 * a missing report must become a recorded problem, never a silent pass.
 */
async function waitForNativeReport(
  target = process.env.BLOG_DOM_NATIVE_REPORT,
): Promise<{ native: NativeReport | null, nativeIssues: string[] }> {
  if (target === undefined) {
    return {
      native: null,
      nativeIssues: ['the configuration named no native Vitest report for this invocation'],
    }
  }
  // Named relative to the run directory: the same receipt reads the same way on
  // any machine, and it cannot be confused with a checkout path.
  const relative = path.relative(verificationDirectory, target).split(path.sep).join('/')
  let lastError = 'the file does not exist'
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const content = readFileSync(target, 'utf8')
      return {
        native: readNativeReport(content, { file: relative, root: process.cwd() }),
        nativeIssues: [],
      }
    }
    catch (error) {
      lastError = error instanceof Error ? error.message : 'unreadable content'
    }
    await delay(20)
  }
  return {
    native: null,
    nativeIssues: [
      `the native Vitest report is missing or unreadable (${relative}): ${lastError}`,
    ],
  }
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'unserializable error'
}
