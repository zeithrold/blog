import type { BrowserReference, LayerEvidence, SourceIdentity } from './types'
import type { Evidence } from '~/tests/support/browser/control-evidence'
import { assessEvidence, fileEvidence } from '~/tests/support/browser/control-evidence'
import { controlInventory } from '~/tests/support/browser/control-inventory'
import { nativeCaseKey } from './discovery'

// Transitional only: these two surfaces now have rule-level, cross-layer proof.
// Other surfaces retain their previous strict browser obligations until migrated.
const migratedSurfaces = new Set(['documents', 'catalog'])
export const migratedControls = controlInventory.filter(control => migratedSurfaces.has(control.surface))
export const unmigratedControls = controlInventory.filter(control => !migratedSurfaces.has(control.surface))

function browserCases(reports: LayerEvidence[]): Evidence[] {
  return reports.flatMap(report => report.cases.flatMap((entry) => {
    if (entry.project === undefined) {
      return []
    }
    return [
      {
        ...entry,
        project: entry.project,
        caseTitle: entry.title,
        checkpoints: [entry.title],
        annotations: entry.annotations ?? [],
      },
    ]
  }))
}

export function assessLegacyControls(
  reports: LayerEvidence[],
  context: { runId: string, source: SourceIdentity },
  expected: readonly BrowserReference[],
): { passed: boolean, total: number, missing: string[], unexplainedSkips: string[], planIssues: string[] } {
  const current = reports.filter(report => report.layer === 'e2e' && report.runId === context.runId
    && report.source.revision === context.source.revision && report.source.fingerprint === context.source.fingerprint)
  const results = browserCases(current)
  const planIssues = [
    ...assessNativePlan(current, expected),
    ...results.filter(entry => !(entry.status === 'passed' && entry.retry === 0)
      && !assessEvidence(results, entry).excluded)
      .map(entry => `Native case did not pass without retry: ${entry.project} › ${entry.file} › ${entry.title}`),
  ]
  const missing = unmigratedControls.filter(control =>
    ['chromium', 'webkit'].some(project =>
      control.evidence.some(file => !fileEvidence(results, file, project).passed)))
    .map(control => control.id)
  const unexplainedSkips = results.filter(entry =>
    entry.status === 'skipped' && !assessEvidence(results, entry).excluded)
    .map(entry => `${entry.project} › ${entry.file} › ${entry.title}`)
  return {
    passed: current.length > 0 && current.every(report => report.complete) && planIssues.length === 0
      && missing.length === 0 && unexplainedSkips.length === 0,
    total: unmigratedControls.length,
    missing,
    unexplainedSkips,
    planIssues,
  }
}

/** A successful focused invocation is not proof that the full suite executed. */
export function assessNativePlan(reports: LayerEvidence[], expected: readonly BrowserReference[]): string[] {
  const cases = reports.flatMap(report => report.cases)
  const required = expected.flatMap(reference => reference.projects.map(project =>
    nativeCaseKey({ ...reference, project, describe: Array.from(reference.describe ?? []) })))
  if (required.length === 0 || new Set(required).size !== required.length) {
    return ['Native discovery must contain a nonempty, unique case plan']
  }
  const counts = new Map<string, number>()
  for (const entry of cases) {
    const key = nativeCaseKey(entry)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const requiredKeys = new Set(required)
  const unexpected = Array.from(counts.keys()).filter(key => !requiredKeys.has(key))
  return [
    ...required.filter(key => counts.get(key) !== 1).map(key =>
      `Expected exactly one native execution, found ${counts.get(key) ?? 0}: ${key}`),
    ...unexpected.map(key => `Unexpected native execution: ${key}`),
  ]
}
