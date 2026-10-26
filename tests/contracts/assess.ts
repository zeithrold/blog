import type { z } from 'zod'
import type { Browser, CaseEvidence, Layer, NodeReference, SourceIdentity, VerificationContract } from './types'
import { domCaseKey } from './discovery'
import { contractSchema, layerEvidenceSchema } from './schema'

const layers: Layer[] = [
  'unit',
  'integration',
  'dom',
  'component',
  'e2e',
]
type Report = z.infer<typeof layerEvidenceSchema>
type Reference = VerificationContract[Layer][number]
export type ContractIssue = { contract: string, layer: Layer, reason: string }

function matches(test: CaseEvidence, reference: Reference, project: Browser | undefined): boolean {
  // An omitted `describe` means a top-level case, never any nesting: a nested
  // case must not answer for the top-level title a contract cites.
  return test.file === reference.file && test.title === reference.title && test.project === project
    && JSON.stringify(test.describe) === JSON.stringify(reference.describe ?? [])
}

function referenceIssues(reports: Report[], reference: Reference): string[] {
  const projects = 'projects' in reference ? reference.projects : [undefined]
  return projects.flatMap((project) => {
    const found = reports.flatMap(report => report.cases).filter(test => matches(test, reference, project))
    const label = `${reference.file} › ${reference.title}${project === undefined ? '' : ` (${project})`}`
    if (found.length === 0) {
      return [
        `${label}: no executed case in this prepared run`,
      ]
    }
    if (found.length > 1) {
      return [
        `${label}: ${found.length} executed cases in one prepared run, so no single result proves it`,
      ]
    }
    return found.every(test => test.status === 'passed' && test.retry === 0)
      ? []
      : [
          `${label}: the case did not pass without retry`,
        ]
  })
}

function layerIssues(
  contract: VerificationContract,
  layer: Layer,
  reports: Report[],
  context: { runId: string, source: SourceIdentity },
): string[] {
  const references = contract[layer]
  const { runId, source } = context
  if (references.length === 0) {
    return contract.primary === layer ? ['Primary proof layer has no references'] : []
  }
  const current = reports.filter(report => report.layer === layer && report.runId === runId
    && report.source.revision === source.revision && report.source.fingerprint === source.fingerprint)
  if (current.length === 0 || current.some(report => !report.complete)) {
    return ['Missing, stale or incomplete native execution report']
  }
  return references.flatMap(reference => referenceIssues(current, reference))
}

/** A contract is proved by exact cases, never by the presence or success of a file. */
export function assessContracts(
  contracts: readonly VerificationContract[],
  evidence: readonly unknown[],
  runId: string,
  source: SourceIdentity,
): { passed: boolean, issues: ContractIssue[] } {
  const parsed = contracts.map(contract => contractSchema.parse(contract))
  const reports = evidence.map(report => layerEvidenceSchema.parse(report))
  const ids = parsed.map(contract => contract.id)
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error('Contract IDs must be nonempty and unique')
  }
  const issues = parsed.flatMap(contract => layers.flatMap(layer =>
    layerIssues(contract, layer, reports, { runId, source })
      .map(reason => ({ contract: contract.id, layer, reason }))))
  return { passed: issues.length === 0, issues }
}

/**
 * The `dom` layer's plan obligation, for the batch it belongs to.
 *
 * It is mandatory for a full batch, independent of what any rule cites: `check:base`
 * runs the layer, so its absence is a failure, not a question. Otherwise an empty
 * `contract.dom` would quietly turn the layer into an optional one, and a batch
 * that never ran jsdom would still report `passed`.
 *
 * A case counts as an execution only when it *is* a jsdom result: no Playwright
 * project, passed, and not retried. `complete` is a summary, so it is never
 * trusted in place of those facts — a report that claims completeness while a case
 * names chromium, was skipped or only passed on a retry fails here, and such a case
 * cannot satisfy the plan either.
 */
export function assessDomPlan(
  evidence: readonly unknown[],
  expected: readonly NodeReference[],
  context: { runId: string, source: SourceIdentity },
): string[] {
  const { runId, source } = context
  const reports = evidence.map(report => layerEvidenceSchema.parse(report))
    .filter(report => report.layer === 'dom')
  const current = reports.filter(report => report.runId === runId
    && report.source.revision === source.revision
    && report.source.fingerprint === source.fingerprint)
  if (current.length === 0) {
    return [
      reports.length === 0
        ? 'No DOM execution report in this batch: run `pnpm test:dom` after `pnpm test:prepare`'
        : `Only stale DOM execution reports (${reports.length}): none belongs to this prepared run and source`,
    ]
  }
  const entries = current.flatMap(report => report.cases)
  const issues = [
    ...current.filter(report => !report.complete)
      .map(() => 'DOM execution report is incomplete'),
    ...entries.flatMap(caseIssues),
  ]
  const required = expected.map(reference => domCaseKey(reference))
  if (required.length === 0 || new Set(required).size !== required.length) {
    return [
      ...issues,
      'DOM discovery must contain a nonempty, unique case plan',
    ]
  }
  const counts = new Map<string, number>()
  for (const entry of entries.filter(isJsdomExecution)) {
    const key = domCaseKey(entry)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const planned = new Set(required)
  return [
    ...issues,
    ...required.filter(key => counts.get(key) !== 1)
      .map(key => `Expected exactly one DOM execution, found ${counts.get(key) ?? 0}: ${key}`),
    ...Array.from(counts.keys()).filter(key => !planned.has(key)).map(key => `Unexpected DOM execution: ${key}`),
  ]
}

/** A jsdom case is one that can be cited: native, passed, and not retried. */
function isJsdomExecution(entry: CaseEvidence): boolean {
  return entry.project === undefined && entry.status === 'passed' && entry.retry === 0
}

function caseIssues(entry: CaseEvidence): string[] {
  const label = `${entry.file} > ${entry.title}`
  const issues: string[] = []
  if (entry.project !== undefined) {
    issues.push(`${label}: a jsdom case names no browser project (${entry.project})`)
  }
  if (entry.status !== 'passed') {
    issues.push(`${label}: ${entry.status}`)
  }
  if (entry.retry !== 0) {
    issues.push(`${label}: passed only after ${entry.retry} attempt(s)`)
  }
  return issues
}
