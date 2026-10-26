import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { z } from 'zod'
import { currentRun, verificationRoot } from '~/tests/support/verification/paths'
import { sourceIdentity } from '~/tests/support/verification/source'
import { assessControlMap } from './accountability'
import { assessContracts, assessDomPlan } from './assess'
import { documentsCatalogControlMap } from './control-map'
import { discoverBrowserCases, discoverDomCases } from './discovery'
import { assessLegacyControls, migratedControls } from './legacy'
import { documentsCatalogContracts, migrationServerContracts } from './registry'
import { layerEvidenceSchema } from './schema'

async function readReports(): Promise<unknown[]> {
  const files = (await readdir(verificationRoot)).filter(file =>
    /^(?:unit|integration|dom|component|e2e)(?:-[\w-]+)?\.json$/.test(file))
  return await Promise.all(files.map(async file =>
    JSON.parse(await readFile(path.join(verificationRoot, file), 'utf8')) as unknown))
}

function requireCurrentRun(): NonNullable<ReturnType<typeof currentRun>> {
  const run = currentRun()
  const source = sourceIdentity()
  if (run === null || run.revision !== source.revision || run.fingerprint !== source.fingerprint) {
    throw new Error('Prepare and execute the native checks for this source before checking contracts')
  }
  return run
}

function legacyAssessment(reports: unknown[], scope: string, run: ReturnType<typeof requireCurrentRun>) {
  return scope === 'all'
    ? assessLegacyControls(
        reports.map(report => layerEvidenceSchema.parse(report)),
        { runId: run.id, source: run },
        [
          ...discoverBrowserCases(),
          ...discoverBrowserCases('playwright.components.config.ts'),
        ],
      )
    : null
}

function legacyPassed(legacy: ReturnType<typeof legacyAssessment>): boolean {
  return legacy === null || legacy.passed
}

function reportIssues(result: {
  issues: { contract: string, layer: string, reason: string }[]
  controlIssues: string[]
  domPlanIssues: string[]
  legacy: ReturnType<typeof legacyAssessment>
}): void {
  for (const issue of result.issues) {
    console.error(`${issue.contract} [${issue.layer}]: ${issue.reason}`)
  }
  const issues = [
    ...result.controlIssues,
    ...result.domPlanIssues,
    ...result.legacy?.planIssues ?? [],
  ]
  for (const issue of issues) {
    console.error(issue)
  }
}

async function verify(): Promise<void> {
  const scope = z.enum(['all', 'documents-catalog']).parse(process.argv[2] ?? 'all')
  const run = requireCurrentRun()
  const source = sourceIdentity()
  const reports = await readReports()
  const contracts = scope === 'all'
    ? documentsCatalogContracts.concat(migrationServerContracts)
    : documentsCatalogContracts
  const assessment = assessContracts(contracts, reports, run.id, source)
  const controlIssues = assessControlMap(migratedControls, documentsCatalogControlMap, documentsCatalogContracts)
  const legacy = legacyAssessment(reports, scope, run)
  // The jsdom layer is part of every full batch, whether or not a rule cites it
  // yet, so its own plan and completeness are checked here rather than inferred
  // from an exit status that a skipped case would not change.
  const domPlanIssues = scope === 'all'
    ? assessDomPlan(reports, discoverDomCases(), { runId: run.id, source })
    : []
  const result = {
    scope,
    runId: run.id,
    source,
    contracts: contracts.length,
    ...assessment,
    passed: assessment.passed && controlIssues.length === 0 && legacyPassed(legacy)
      && domPlanIssues.length === 0,
    controlIssues,
    domPlanIssues,
    legacy,
  }
  await writeFile(path.join(verificationRoot, 'contract-coverage.json'), JSON.stringify(result, null, 2))
  reportIssues(result)
  if (!result.passed) {
    const count = legacy?.missing.length ?? 0
    throw new Error(`Contract proof incomplete: ${result.issues.length} rule issue(s), ${count} legacy controls`)
  }
  console.warn(`Verification contracts (${scope}): ${result.contracts} proved by exact native case results`)
}

verify().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
