import type { CaseEvidence, LayerEvidence, SourceIdentity } from '~/tests/contracts/types'
import path from 'node:path'
import { z } from 'zod'

/*
 * The `dom` layer's evidence, built from values a reporter captured — never from
 * whatever the run directory happens to contain when the run ends.
 *
 * A jsdom probe is not a browser: it runs React, the client and the schemas for
 * real, but it proves no engine, Worker, route or hydration. Its cases therefore
 * carry no Playwright project, and nothing here may label them chromium or webkit.
 *
 * The batch binding is the part that cannot be inferred afterwards. A report is
 * only same-batch evidence when the manifest that existed when the run *started*
 * still exists, unchanged, when it ends. Otherwise a concurrent `test:prepare`
 * from another run would relabel this one's results as its own.
 */

export type PreparedRun = SourceIdentity & { id: string }

export type NativeAssertion = {
  readonly file: string
  readonly describe: readonly string[]
  readonly title: string
  readonly status: string
}

/** The parts of Vitest's own JSON report this layer cross-checks and retains. */
export type NativeReport = {
  readonly file: string
  readonly total: number
  readonly passed: number
  readonly failed: number
  readonly pending: number
  readonly cases: readonly NativeAssertion[]
}

export type DomEvidenceInput = {
  readonly invocation: string
  readonly evidenceFile: string
  readonly tool: { readonly version: string, readonly environment: string }
  readonly startedAt: Date
  readonly endedAt: Date
  readonly reason: string
  readonly unhandledErrors: readonly string[]
  readonly cases: readonly CaseEvidence[]
  readonly preparedAtStart: PreparedRun | null
  readonly preparedAtEnd: PreparedRun | null
  readonly sourceAtStart: SourceIdentity
  readonly sourceAtEnd: SourceIdentity
  readonly native: NativeReport | null
  readonly nativeIssues: readonly string[]
}

const identitySchema = z.strictObject({
  revision: z.string().min(1),
  fingerprint: z.string().min(1),
})

const preparedSchema = identitySchema.extend({ id: z.uuid() })

// Vitest owns this format and adds fields between releases; read the ones this
// layer cross-checks and leave the rest alone.
const nativeReportSchema = z.object({
  numTotalTests: z.number().int().nonnegative(),
  numPassedTests: z.number().int().nonnegative(),
  numFailedTests: z.number().int().nonnegative(),
  numPendingTests: z.number().int().nonnegative(),
  testResults: z.array(z.object({
    name: z.string().min(1),
    assertionResults: z.array(z.object({
      ancestorTitles: z.array(z.string()),
      title: z.string().min(1),
      status: z.string().min(1),
    })),
  })),
})

/** Vitest's own report, reduced to what this layer retains and cross-checks. */
export function readNativeReport(
  content: string,
  options: { readonly file: string, readonly root: string },
): NativeReport {
  const parsed = nativeReportSchema.parse(JSON.parse(content))
  return {
    file: options.file,
    total: parsed.numTotalTests,
    passed: parsed.numPassedTests,
    failed: parsed.numFailedTests,
    pending: parsed.numPendingTests,
    cases: parsed.testResults.flatMap(result => result.assertionResults.map(assertion => ({
      file: path.relative(options.root, result.name).split(path.sep).join('/'),
      describe: assertion.ancestorTitles,
      title: assertion.title,
      status: assertion.status,
    }))),
  }
}

export function caseKey(
  entry: Pick<CaseEvidence, 'file' | 'title'> & { readonly describe?: readonly string[], readonly status?: string },
): string {
  return JSON.stringify([
    entry.file,
    [
      ...entry.describe ?? [],
    ],
    entry.title,
    entry.status ?? '',
  ])
}

function identity(entry: SourceIdentity): string {
  return `${entry.revision}:${entry.fingerprint}`
}

function sorted<T>(entries: readonly T[], key: (entry: T) => string): T[] {
  return [
    ...entries,
  ].sort((left, right) => key(left).localeCompare(key(right)))
}

/**
 * Why an invocation is not same-batch proof. Every entry here is a reason the
 * result may not be cited, including the ones an exit status cannot express:
 * a skipped case, a retried pass, an empty run and a replaced manifest all
 * leave the process successful.
 */
export function domProblems(input: DomEvidenceInput): string[] {
  return [
    ...runProblems(input),
    ...caseProblems(input.cases),
    ...batchProblems(input),
    ...nativeProblems(input),
  ]
}

function runProblems(input: DomEvidenceInput): string[] {
  return [
    ...input.reason === 'passed'
      ? []
      : [
          `the run did not finish: ${input.reason}`,
        ],
    ...input.unhandledErrors.length === 0
      ? []
      : [
          `${input.unhandledErrors.length} unhandled error(s) escaped the run`,
        ],
  ]
}

function caseProblems(cases: readonly CaseEvidence[]): string[] {
  if (cases.length === 0) {
    return ['no executed case was recorded']
  }
  return cases.flatMap((entry) => {
    if (entry.status !== 'passed') {
      return [
        `${entry.file} > ${entry.title}: ${entry.status}`,
      ]
    }
    if (entry.retry === 0) {
      return []
    }
    const attempts = entry.retry === 1 ? 'retry' : 'retries'
    return [
      `${entry.file} > ${entry.title}: passed only after ${entry.retry} ${attempts}`,
    ]
  })
}

function batchProblems(input: DomEvidenceInput): string[] {
  const problems: string[] = []
  if (identity(input.sourceAtStart) !== identity(input.sourceAtEnd)) {
    problems.push('the source changed while the run executed')
  }
  return [
    ...problems,
    ...manifestProblems(input),
  ]
}

function manifestProblems(input: DomEvidenceInput): string[] {
  const { preparedAtStart, preparedAtEnd } = input
  if (preparedAtStart === null) {
    return ['no prepared run: this invocation is standalone and proves no batch']
  }
  if (preparedAtEnd === null) {
    return [
      `the prepared run manifest disappeared while the run executed (${preparedAtStart.id})`,
    ]
  }
  if (preparedAtEnd.id !== preparedAtStart.id) {
    return [
      'the prepared run manifest was replaced while the run executed '
      + `(${preparedAtStart.id} -> ${preparedAtEnd.id})`,
    ]
  }
  return identity(preparedAtStart) === identity(input.sourceAtStart)
    ? []
    : [
        `the prepared run belongs to another source (${identity(preparedAtStart)})`,
      ]
}

function nativeProblems(input: DomEvidenceInput): string[] {
  if (input.native === null) {
    // A receipt without the runner's own report is not a receipt: never let an
    // empty issue list stand in for a report that was never read.
    return input.nativeIssues.length === 0
      ? ['the native Vitest report is missing']
      : [
          ...input.nativeIssues,
        ]
  }
  const problems: string[] = []
  const recorded = sorted(input.cases, caseKey).map(caseKey)
  const reported = sorted(input.native.cases, caseKey).map(caseKey)
  if (JSON.stringify(recorded) !== JSON.stringify(reported)) {
    problems.push('the native Vitest report does not list the same cases as this receipt')
  }
  if (input.native.total !== input.cases.length) {
    problems.push(`the native Vitest report counts ${input.native.total} case(s), the receipt ${input.cases.length}`)
  }
  return problems
}

/**
 * A run id is only a same-batch claim when one manifest served the whole run.
 * A standalone or replaced run reports null instead of borrowing a batch.
 */
export function domRunId(input: DomEvidenceInput): string | null {
  const { preparedAtStart, preparedAtEnd, sourceAtStart } = input
  if (preparedAtStart === null || preparedAtEnd === null) {
    return null
  }
  if (preparedAtStart.id !== preparedAtEnd.id) {
    return null
  }
  return identity(preparedAtStart) === identity(sourceAtStart) ? preparedAtStart.id : null
}

export type DomEvidence = {
  readonly evidence: LayerEvidence
  readonly receipt: DomReceipt
  readonly problems: readonly string[]
}

/** The tool receipt beside the layer proof. Nothing that assesses a rule reads it. */
export const domReceiptSchema = z.strictObject({
  schemaVersion: z.literal(1),
  layer: z.literal('dom'),
  invocation: z.string().min(1),
  tool: z.strictObject({
    name: z.literal('vitest'),
    version: z.string().min(1),
    environment: z.string().min(1),
  }),
  run: z.strictObject({
    startedAt: z.string(),
    endedAt: z.string(),
    durationMs: z.number().nonnegative(),
  }),
  prepared: z.strictObject({
    atStart: preparedSchema.nullable(),
    atEnd: preparedSchema.nullable(),
    runId: z.uuid().nullable(),
  }),
  source: z.strictObject({ before: identitySchema, after: identitySchema }),
  reason: z.string().min(1),
  complete: z.boolean(),
  problems: z.array(z.string()),
  nativeReport: z.strictObject({
    file: z.string().min(1),
    total: z.number().int().nonnegative(),
    passed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
  }).nullable(),
  evidenceFile: z.string().min(1),
})
export type DomReceipt = z.infer<typeof domReceiptSchema>

/** One invocation in, one layer proof plus one bound tool receipt out. */
export function buildDomEvidence(input: DomEvidenceInput): DomEvidence {
  const problems = domProblems(input)
  const runId = domRunId(input)
  const cases = sorted(input.cases, caseKey)
  return {
    evidence: {
      schemaVersion: 1,
      layer: 'dom',
      runId,
      source: input.sourceAtStart,
      complete: problems.length === 0,
      cases,
    },
    receipt: domReceiptSchema.parse({
      schemaVersion: 1,
      layer: 'dom',
      invocation: input.invocation,
      // The tool identity stays here: a jsdom run must never be read as an engine.
      tool: { name: 'vitest', version: input.tool.version, environment: input.tool.environment },
      run: {
        startedAt: input.startedAt.toISOString(),
        endedAt: input.endedAt.toISOString(),
        durationMs: input.endedAt.getTime() - input.startedAt.getTime(),
      },
      prepared: { atStart: input.preparedAtStart, atEnd: input.preparedAtEnd, runId },
      source: { before: input.sourceAtStart, after: input.sourceAtEnd },
      reason: input.reason,
      complete: problems.length === 0,
      problems,
      // Vitest wrote this report itself; the receipt only names it.
      nativeReport: input.native === null
        ? null
        : {
            file: input.native.file,
            total: input.native.total,
            passed: input.native.passed,
            failed: input.native.failed,
            pending: input.native.pending,
          },
      evidenceFile: input.evidenceFile,
    }),
    problems,
  }
}
