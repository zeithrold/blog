import type { BrowserReference, CaseEvidence, NodeReference } from './types'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { z } from 'zod'

type Suite = {
  title: string
  line: number
  suites: Suite[]
  specs: { title: string, file: string, tests: { projectName: 'chromium' | 'webkit' }[] }[]
}
const suiteSchema: z.ZodType<Suite> = z.object({
  title: z.string(),
  line: z.number(),
  suites: z.array(z.lazy(() => suiteSchema)).default([]),
  specs: z.array(z.object({
    title: z.string(),
    file: z.string(),
    tests: z.array(z.object({ projectName: z.enum(['chromium', 'webkit']) })),
  })).default([]),
})
const planSchema = z.object({
  config: z.object({ rootDir: z.string() }),
  errors: z.array(z.unknown()).length(0),
  suites: z.array(suiteSchema),
})

function references(suite: Suite, ancestors: string[] = []): BrowserReference[] {
  const describe = suite.line === 0
    ? ancestors
    : [
        ...ancestors,
        suite.title,
      ]
  return [
    ...suite.specs.flatMap(spec => spec.tests.map(test => ({
      file: spec.file,
      title: spec.title,
      describe,
      projects: [test.projectName],
    }))),
    ...suite.suites.flatMap(child => references(child, describe)),
  ]
}

/** Native discovery only: --list starts neither a browser nor the Worker. */
export function discoverBrowserCases(config = 'playwright.config.ts'): BrowserReference[] {
  const output = execFileSync('pnpm', [
    'exec',
    'playwright',
    'test',
    '--config',
    config,
    '--project=chromium',
    '--project=webkit',
    '--list',
    '--reporter=json',
  ], { encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024 })
  const plan = planSchema.parse(JSON.parse(output))
  return plan.suites.flatMap(suite => references(suite)).map(reference => ({
    ...reference,
    file: path.relative(process.cwd(), path.resolve(plan.config.rootDir, reference.file)).split(path.sep).join('/'),
  }))
}

export function nativeCaseKey(test: Pick<CaseEvidence, 'file' | 'title' | 'describe' | 'project'>): string {
  return JSON.stringify([
    test.project,
    test.file,
    test.describe,
    test.title,
  ])
}

/*
 * The `dom` layer is discovered natively, like the browser layers: `vitest list`
 * collects the modules and executes nothing. A case is its file plus its suite
 * path, so a focused run cannot stand in for the layer's full plan.
 */
const domPlanSchema = z.array(z.strictObject({
  name: z.string().min(1),
  file: z.string().min(1),
  // Listing carries a declaration site and no result: nothing executed.
  location: z.strictObject({
    line: z.number().int().positive(),
    column: z.number().int().positive(),
  }),
}))

const ancestorSeparator = ' > '

/** Vitest joins a case with its suites by `>`; list mode exposes no other path. */
export function splitDomName(fullName: string): { describe: string[], title: string } {
  const parts = fullName.split(ancestorSeparator)
  const title = parts.pop() ?? fullName
  return { describe: parts, title }
}

/** Collect native registrations, including loop-generated titles, without running cases. */
export function discoverDomCases(config = 'vitest.dom.config.ts'): NodeReference[] {
  const output = execFileSync('pnpm', [
    'exec',
    'vitest',
    'list',
    '--config',
    config,
    '--staticParse=false',
    '--includeTaskLocation',
    // Keep this last: Vitest also accepts a filename as the value of --json.
    '--json',
  ], { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 })
  return domPlanSchema.parse(JSON.parse(output)).map(entry => ({
    file: path.relative(process.cwd(), entry.file).split(path.sep).join('/'),
    ...splitDomName(entry.name),
  }))
}

/** A DOM case is named without a project: the layer is jsdom, not an engine. */
export function domCaseKey(
  test: Pick<CaseEvidence, 'file' | 'title'> & { readonly describe?: readonly string[] },
): string {
  return JSON.stringify([
    test.file,
    [
      ...test.describe ?? [],
    ],
    test.title,
  ])
}
