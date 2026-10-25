import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter'
import type { Browser, LayerEvidence } from '~/tests/contracts/types'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { z } from 'zod'
import { currentRun, verificationRoot } from './paths'
import { sourceIdentity } from './source'

function isBrowser(name: string | undefined): name is Browser {
  return name === 'chromium' || name === 'webkit'
}

export default class ContractReporter implements Reporter {
  private readonly evidence: LayerEvidence
  /** Skip only a positively identified performance-only invocation, never an unknown failure. */
  private performanceOnly = false

  constructor(options: { layer: 'component' | 'e2e' }) {
    this.evidence = {
      schemaVersion: 1,
      layer: options.layer,
      runId: currentRun()?.id ?? null,
      source: sourceIdentity(),
      complete: false,
      cases: [],
    }
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    // The root suite holds only the projects this invocation runs, so a
    // performance-only run is not mistaken for a functional one with zero cases.
    this.performanceOnly = suite.suites.length > 0
      && suite.suites.every(projectSuite => projectSuite.project()?.name === 'performance')
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const project = test.parent.project()?.name
    if (!isBrowser(project)) {
      return
    }
    const describe: string[] = []
    let suite: Suite | undefined = test.parent
    while (suite?.type === 'describe') {
      describe.unshift(suite.title)
      suite = suite.parent
    }
    this.evidence.cases.push({
      file: path.relative(process.cwd(), test.location.file),
      title: test.title,
      describe,
      project,
      status: result.status,
      retry: result.retry,
      // Native annotations also carry source locations. The proof format needs
      // only their semantic type/reason, including exact platform-skip reasons.
      annotations: test.annotations.map(({ type, description }) => ({ type, description })),
    })
  }

  async onEnd(result: FullResult): Promise<void> {
    if (this.performanceOnly) {
      return
    }
    // Zero recorded cases is failure evidence for a functional invocation; it is
    // never a reason to leave an earlier passing report in place.
    this.evidence.complete = result.status === 'passed' && this.evidence.cases.length > 0
      && (this.evidence.layer !== 'component'
        || this.evidence.cases.every(entry => entry.status === 'passed' && entry.retry === 0))
    const scopeValue = process.env.BLOG_PROOF_SCOPE ?? process.env.BLOG_TEST_RUN_ID ?? 'local'
    const scope = z.string().regex(/^[\w-]+$/).parse(scopeValue)
    await mkdir(verificationRoot, { recursive: true })
    // One file per invocation: a later run in the same prepared run must not
    // overwrite the evidence an earlier one produced.
    await writeFile(
      path.join(verificationRoot, `${this.evidence.layer}-${scope}-${randomUUID()}.json`),
      JSON.stringify(this.evidence, null, 2),
    )
  }
}
