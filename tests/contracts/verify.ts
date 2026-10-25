import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { z } from 'zod'
import { currentRun, verificationRoot } from '~/tests/support/verification/paths'
import { sourceIdentity } from '~/tests/support/verification/source'
import { assessControlMap } from './accountability'
import { assessContracts } from './assess'
import { documentsCatalogControlMap } from './control-map'
import { discoverBrowserCases } from './discovery'
import { assessLegacyControls, migratedControls } from './legacy'
import { documentsCatalogContracts } from './registry'
import { layerEvidenceSchema } from './schema'

async function readReports(): Promise<unknown[]> {
  const files = (await readdir(verificationRoot)).filter(file =>
    /^(?:unit|integration|component|e2e)(?:-[\w-]+)?\.json$/.test(file))
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
        discoverBrowserCases(),
      )
    : null
}

function legacyPassed(legacy: ReturnType<typeof legacyAssessment>): boolean {
  return legacy === null || legacy.passed
}

function reportIssues(result: {
  issues: { contract: string, layer: string, reason: string }[]
  controlIssues: string[]
  legacy: ReturnType<typeof legacyAssessment>
}): void {
  for (const issue of result.issues) {
    console.error(`${issue.contract} [${issue.layer}]: ${issue.reason}`)
  }
  const issues = [
    ...result.controlIssues,
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
  const assessment = assessContracts(documentsCatalogContracts, reports, run.id, source)
  const controlIssues = assessControlMap(migratedControls, documentsCatalogControlMap, documentsCatalogContracts)
  const legacy = legacyAssessment(reports, scope, run)
  const result = {
    scope,
    runId: run.id,
    source,
    contracts: documentsCatalogContracts.length,
    ...assessment,
    passed: assessment.passed && controlIssues.length === 0 && legacyPassed(legacy),
    controlIssues,
    legacy,
  }
  await writeFile(path.join(verificationRoot, 'contract-coverage.json'), JSON.stringify(result, null, 2))
  reportIssues(result)
  if (!result.passed) {
    const count = legacy?.missing.length ?? 0
    throw new Error(`Contract proof incomplete: ${result.issues.length} rule issue(s), ${count} legacy controls`)
  }
  console.warn(`Documents/catalog contracts: ${result.contracts} proved by exact native case results`)
}

verify().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
