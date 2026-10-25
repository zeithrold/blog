import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test as nodeTest } from 'node:test'
import { z } from 'zod'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

type Suite = {
  title: string
  suites: Suite[]
  specs: {
    title: string
    file: string
    line: number
    column: number
    tests: { projectName: string }[]
  }[]
}

const suiteSchema: z.ZodType<Suite> = z.object({
  title: z.string(),
  suites: z.array(z.lazy(() => suiteSchema)).default([]),
  specs: z.array(z.object({
    title: z.string(),
    file: z.string(),
    line: z.number(),
    column: z.number(),
    tests: z.array(z.object({ projectName: z.string() })),
  })).default([]),
})
const planSchema = z.object({
  config: z.object({ workers: z.number(), fullyParallel: z.boolean() }),
  errors: z.array(z.unknown()),
  suites: z.array(suiteSchema),
})
type PlannedCase = { id: string, file: string, project: string }

function discover(args: string[], script?: 'test:e2e' | 'test:core'): PlannedCase[] {
  const command = script !== undefined
    ? [script]
    : [
        'exec',
        'playwright',
        'test',
      ]
  const output = execFileSync('pnpm', [
    ...command,
    ...args,
    '--list',
    '--reporter=json',
  ], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30000,
  })
  const plan = planSchema.parse(JSON.parse(output))
  deepEqual(plan.errors, [])
  equal(plan.config.workers, 1, 'A resettable Worker belongs to one test at a time')
  equal(plan.config.fullyParallel, false, 'Shards must keep files and journeys together')
  return plan.suites.flatMap(suite => cases(suite))
}

function cases(suite: Suite, ancestors: string[] = []): PlannedCase[] {
  const titles = [
    ...ancestors,
    suite.title,
  ]
  return [
    ...suite.specs.flatMap(spec => spec.tests.map(test => ({
      // Locations are diagnostic metadata, not identity; moving a declaration
      // must not change which logical case a shard is obliged to execute.
      id: JSON.stringify([
        test.projectName,
        spec.file,
        ...titles,
        spec.title,
      ]),
      file: spec.file,
      project: test.projectName,
    }))),
    ...suite.suites.flatMap(child => cases(child, titles)),
  ]
}

function ids(plan: PlannedCase[]): string[] {
  return plan.map(test => test.id).sort()
}

nodeTest('four isolated browser shards preserve the full plan and core journeys remain a subset', () => {
  const baseline = discover([], 'test:e2e')
  assert.ok(baseline.length > 0)
  equal(new Set(ids(baseline)).size, baseline.length, 'Baseline identities must be unique')
  const combined: PlannedCase[] = []
  for (const project of ['chromium', 'webkit']) {
    const first = discover([
      `--project=${project}`,
      '--shard=1/2',
    ])
    const second = discover([
      `--project=${project}`,
      '--shard=2/2',
    ])
    assert.ok(first.length > 0 && second.length > 0, `${project} shards must not be empty`)
    assert.ok([
      ...first,
      ...second,
    ].every(test => test.project === project))
    const firstFiles = new Set(first.map(test => test.file))
    assert.ok(second.every(test => !firstFiles.has(test.file)), `${project} must not split test files`)
    combined.push(...first, ...second)
  }
  deepEqual(ids(combined), ids(baseline))
  const core = discover([], 'test:core')
  const baselineIds = new Set(ids(baseline))
  assert.ok(core.length > 0 && core.length < baseline.length)
  assert.ok(core.every(test => baselineIds.has(test.id)), 'Core checks supplement, never replace, full coverage')
  for (const project of ['chromium', 'webkit']) {
    assert.ok(core.some(test => test.project === project), `Core checks must include ${project}`)
  }
  console.warn(`Browser plan: ${baseline.length} cases preserved across four shards; ${core.length} core cases`)
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test plan failed'))
