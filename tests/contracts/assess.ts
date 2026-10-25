import type { z } from 'zod'
import type { Browser, CaseEvidence, Layer, SourceIdentity, VerificationContract } from './types'
import { contractSchema, layerEvidenceSchema } from './schema'

const layers: Layer[] = [
  'unit',
  'integration',
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
