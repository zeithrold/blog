import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { test as nodeTest } from 'node:test'
import { z } from 'zod'
import { componentMigrations } from '~/tests/contracts/component-migrations'
import { documentsCatalogContracts, retainedCaseKeys, retiredCaseKeys } from '~/tests/contracts/registry'
import { surfaceMigrations } from '~/tests/contracts/surface-migrations'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

type Suite = {
  title: string
  line: number
  suites: Suite[]
  specs: {
    title: string
    file: string
    line: number
    column: number
    tests: { projectName: string, results: unknown[] }[]
  }[]
}

const suiteSchema: z.ZodType<Suite> = z.object({
  title: z.string(),
  line: z.number(),
  suites: z.array(z.lazy(() => suiteSchema)).default([]),
  specs: z.array(z.object({
    title: z.string(),
    file: z.string(),
    line: z.number(),
    column: z.number(),
    tests: z.array(z.object({
      projectName: z.string(),
      results: z.array(z.unknown()).default([]),
    })),
  })).default([]),
})

const planSchema = z.object({
  config: z.object({
    configFile: z.string(),
    rootDir: z.string(),
    workers: z.number(),
  }),
  errors: z.array(z.unknown()),
  suites: z.array(suiteSchema),
})

/** One case a configuration declares, named the way the contract ledger names it. */
type PlannedCase = {
  file: string
  title: string
  describe: readonly string[]
  project: string
  executions: number
}

type Layer = 'e2e' | 'components'

const configurations: Record<Layer, { configFile: string, args: string[] }> = {
  e2e: { configFile: 'playwright.config.ts', args: ['test:e2e'] },
  components: {
    configFile: 'playwright.components.config.ts',
    args: [
      'exec',
      'playwright',
      'test',
      '--config',
      'playwright.components.config.ts',
    ],
  },
}

const browsers = ['chromium', 'webkit'] as const
const retainedSurfaceKeys = new Set(surfaceMigrations.flatMap(migration =>
  migration.retained.flatMap(group => group.cases)))
const componentRoot = 'tests/components/'
const browserRoot = 'tests/browser/'
const plans = new Map<Layer, PlannedCase[]>()

/**
 * Listing is the only safe proof of a plan. Nothing executes, so the shared browser
 * server and its resettable D1 Worker never start, and every case stays an exact
 * file, title and project rather than a file that merely exists.
 */
function discover(layer: Layer): PlannedCase[] {
  const cached = plans.get(layer)
  if (cached !== undefined) {
    return cached
  }
  const { args, configFile } = configurations[layer]
  const output = execFileSync('pnpm', [
    ...args,
    '--list',
    '--reporter=json',
  ], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 60000,
  })
  const plan = planSchema.parse(JSON.parse(output))
  assert.deepEqual(plan.errors, [])
  equal(path.basename(plan.config.configFile), configFile, `${layer} must be listed from ${configFile}`)
  equal(plan.config.workers, 1, 'One resettable Worker belongs to one test at a time')
  const discovered = plan.suites.flatMap(suite => cases(suite, plan.config.rootDir))
  assert.ok(discovered.length > 0, `${layer} must list at least one case`)
  equal(discovered.filter(entry => entry.executions > 0).length, 0, 'A listing must not execute a case')
  plans.set(layer, discovered)
  return discovered
}

function cases(suite: Suite, rootDir: string, ancestors: readonly string[] = []): PlannedCase[] {
  const describe = suite.line === 0 ? ancestors : ancestors.concat(suite.title)
  const specs = suite.specs.flatMap(spec => spec.tests.map(test => ({
    file: sourceFile(rootDir, spec.file),
    title: spec.title,
    describe,
    project: test.projectName,
    executions: test.results.length,
  })))
  return specs.concat(suite.suites.flatMap(child => cases(child, rootDir, describe)))
}

/** Playwright reports spec files relative to the configuration `rootDir`. */
function sourceFile(rootDir: string, file: string): string {
  return path.relative(process.cwd(), path.resolve(rootDir, file)).split(path.sep).join('/')
}

/** Migration keys are `<file> :: <title>`, the same shape the registry parses. */
function caseKeyParts(key: string): { file: string, title: string } {
  const [file, title, extra] = key.split(' :: ')
  if (file === undefined || title === undefined || extra !== undefined) {
    throw new Error(`Invalid migration case key: ${key}`)
  }
  return { file, title }
}

function count(plan: readonly PlannedCase[], key: { file: string, title: string }, project: string): number {
  return plan.filter(entry => entry.file === key.file && entry.title === key.title
    && entry.project === project).length
}

function referenceFiles(layer: 'component' | 'e2e'): Set<string> {
  return new Set(documentsCatalogContracts.flatMap(contract =>
    contract[layer].map(reference => reference.file)))
}

nodeTest('the migration table retires exactly the legacy cases it replaced', () => {
  const legacy = new Set(componentMigrations.flatMap(migration => migration.legacy))
  const retained = Array.from(retainedCaseKeys).sort()
  const retired = Array.from(retiredCaseKeys).sort()
  equal(retained.length, 24, 'Retained cases keep their real E2E proof')
  equal(retired.length, 22, 'Retired cases move to component proof')
  deepEqual(retained.concat(retired).sort(), Array.from(legacy).sort())
  equal(retained.filter(key => retiredCaseKeys.has(key)).length, 0, 'Nothing is both retained and retired')
  for (const key of legacy) {
    assert.ok(caseKeyParts(key).file.endsWith('.spec.ts'), `Migration keys name a spec file: ${key}`)
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('retired E2E cases no longer run in either browser', () => {
  const e2e = discover('e2e')
  const present: string[] = []
  for (const key of Array.from(retiredCaseKeys).sort()) {
    const parts = caseKeyParts(key)
    for (const project of browsers) {
      const found = count(e2e, parts, project)
      if (found > 0) {
        present.push(`${project} › ${key}: listed ${found} times`)
      }
    }
  }
  assert.deepEqual(present, [], 'Retired cases belong to the component specs, not tests/browser')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('retained E2E cases still run against Chromium and WebKit', () => {
  const e2e = discover('e2e')
  const missing: string[] = []
  for (const key of Array.from(retainedCaseKeys).sort()) {
    const parts = caseKeyParts(key)
    for (const project of browsers) {
      const found = count(e2e, parts, project)
      if (found !== 1) {
        missing.push(`${project} › ${key}: listed ${found} times`)
      }
    }
  }
  assert.deepEqual(missing, [], 'Only the built application can prove the retained cases')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('every declared component reference is a real component case in both browsers', () => {
  const components = discover('components')
  const missing: string[] = []
  for (const contract of documentsCatalogContracts) {
    for (const reference of contract.component) {
      const label = `${contract.id} › ${reference.file} :: ${reference.title}`
      for (const project of browsers) {
        if (!reference.projects.includes(project)) {
          missing.push(`${label} does not declare ${project}`)
          continue
        }
        const matching = components.filter(entry =>
          JSON.stringify(entry.describe) === JSON.stringify(reference.describe ?? []))
        const found = count(matching, reference, project)
        if (found !== 1) {
          missing.push(`${project} › ${label}: listed ${found} times`)
        }
      }
    }
  }
  assert.deepEqual(missing, [], 'Component evidence names exact cases, never a file that exists')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('locally replaced surfaces retire old E2E and retain exact component cases', () => {
  const e2e = discover('e2e')
  const components = discover('components')
  for (const migration of surfaceMigrations) {
    for (const project of browsers) {
      for (const key of migration.legacy.filter(entry => !retainedSurfaceKeys.has(entry))) {
        equal(count(e2e, caseKeyParts(key), project), 0, `Retired case still runs: ${project} › ${key}`)
      }
      for (const replacement of migration.component) {
        const matching = components.filter(entry =>
          JSON.stringify(entry.describe) === JSON.stringify(replacement.describe ?? []))
        const found = count(matching, caseKeyParts(replacement.case), project)
        equal(found, 1, `Missing replacement: ${project} › ${replacement.case}`)
      }
    }
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('component and E2E proof never share a path', () => {
  const components = new Set(discover('components').map(entry => entry.file))
  const browser = new Set(discover('e2e').map(entry => entry.file))
  const declared = {
    component: referenceFiles('component'),
    e2e: referenceFiles('e2e'),
  }
  const issues: string[] = []
  for (const file of declared.component) {
    if (!file.startsWith(componentRoot)) {
      issues.push(`Component proof outside ${componentRoot}: ${file}`)
    }
    if (declared.e2e.has(file)) {
      issues.push(`Both layers cite ${file}`)
    }
    if (!components.has(file)) {
      issues.push(`No component case in ${file}`)
    }
  }
  for (const file of declared.e2e) {
    if (!file.startsWith(browserRoot)) {
      issues.push(`E2E proof outside ${browserRoot}: ${file}`)
    }
    if (!browser.has(file)) {
      issues.push(`No E2E case in ${file}`)
    }
  }
  for (const file of components) {
    if (browser.has(file)) {
      issues.push(`Both configurations collect ${file}`)
    }
  }
  assert.deepEqual(issues, [], 'The two harnesses must stay separate')
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))

nodeTest('retained surface boundaries still exist in both E2E projects', () => {
  const e2e = discover('e2e')
  for (const key of retainedSurfaceKeys) {
    for (const project of browsers) {
      const found = key.includes(' :: ')
        ? count(e2e, caseKeyParts(key), project)
        : e2e.filter(entry => entry.file === key && entry.project === project).length
      assert.ok(found > 0, `Missing retained boundary: ${project} › ${key}`)
    }
  }
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))
