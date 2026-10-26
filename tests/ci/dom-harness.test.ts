import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test as nodeTest } from 'node:test'

/*
 * The DOM layer's teardown guarantees, proved by real Vitest runs.
 *
 * A helper can be called from Node and asked whether it would fail, but that is
 * not the claim. The claim is "a case that leaks the fetch boundary fails", so
 * each fixture under `tests/harness/dom` is executed in its own Vitest process
 * with the layer's own config and setup file, and this gate asserts the verdict
 * and the reported reason. Nothing here inspects source or calls a helper.
 *
 * The fixtures live outside `tests/dom`, so the official layer never collects a
 * deliberately failing case. Passing fixtures also control declared transport
 * failures, fetch restoration and `until`'s attribute and timing behavior.
 */

type Fixture = {
  readonly file: string
  /** What the layer must decide for this case. */
  readonly passes: boolean
  /** The reason the layer must report when it fails. */
  readonly reason: string
  /** An in-file passing control required by a deliberately failing fixture. */
  readonly control?: string
}

const fixtures: readonly Fixture[] = [
  {
    file: 'tests/harness/dom/unhandled-request.test.tsx',
    passes: false,
    reason: 'a request had no declared handler: GET /api/admin/undeclared',
  },
  {
    file: 'tests/harness/dom/handler-throws-typeerror.test.tsx',
    passes: false,
    reason: 'a fixture handler threw: TypeError: fixture bug',
  },
  {
    file: 'tests/harness/dom/handler-throws-error.test.tsx',
    passes: false,
    reason: 'a fixture handler threw: Error: fixture bug',
  },
  {
    file: 'tests/harness/dom/unsettled-request.test.tsx',
    passes: false,
    reason: 'a request never settled before the case ended',
  },
  {
    file: 'tests/harness/dom/late-body-read.test.tsx',
    passes: false,
    reason: 'a fixture handler threw: Error: late request body failed',
  },
  {
    file: 'tests/harness/dom/unsettled-body-read.test.tsx',
    passes: false,
    reason: 'a request never settled before the case ended',
  },
  {
    file: 'tests/harness/dom/response-construction-failure.test.tsx',
    passes: false,
    reason: 'a fixture handler threw: TypeError: Response constructor: Invalid response status code 204',
  },
  {
    file: 'tests/harness/dom/case-isolation.test.tsx',
    passes: false,
    reason: 'a request never settled before the case ended',
    control: 'isolation-control: next case used native fetch',
  },
  {
    file: 'tests/harness/dom/until-deadline.test.tsx',
    passes: false,
    reason: 'The DOM state this case waits for never rendered',
  },
  {
    file: 'tests/harness/dom/lifo-dispose.test.tsx',
    passes: true,
    reason: '',
  },
  {
    file: 'tests/harness/dom/out-of-order-dispose.test.tsx',
    passes: true,
    reason: '',
  },
  {
    file: 'tests/harness/dom/repeat-dispose.test.tsx',
    passes: true,
    reason: '',
  },
  {
    file: 'tests/harness/dom/reset-fetch-boundary.test.tsx',
    passes: true,
    reason: '',
  },
  {
    file: 'tests/harness/dom/declared-transport-failure.test.tsx',
    passes: true,
    reason: '',
  },
  {
    file: 'tests/harness/dom/until-observes-attributes.test.tsx',
    passes: true,
    reason: '',
  },
  {
    file: 'tests/harness/dom/until-no-late-evaluation.test.tsx',
    passes: true,
    reason: '',
  },
  {
    file: 'tests/harness/dom/until-condition-throws.test.tsx',
    passes: true,
    reason: '',
  },
]

type Verdict = { readonly passes: boolean, readonly output: string }

function outputOf(error: unknown): string {
  if (error !== null && typeof error === 'object') {
    const stdout = 'stdout' in error && typeof error.stdout === 'string' ? error.stdout : ''
    const stderr = 'stderr' in error && typeof error.stderr === 'string' ? error.stderr : ''
    const message = error instanceof Error ? error.message : ''
    return `${stdout}\n${stderr}\n${message}`
  }
  return 'a thrown value that is not an error'
}

/** One real Vitest run of one fixture, in its own process. */
function run(fixture: Fixture): Verdict {
  try {
    const output = execFileSync('pnpm', [
      'exec',
      'vitest',
      'run',
      '--config',
      'vitest.dom.harness.config.ts',
      fixture.file,
    ], {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000,
    })
    return { passes: true, output }
  }
  catch (error: unknown) {
    return { passes: false, output: outputOf(error) }
  }
}

function assertVerdict(fixture: Fixture): void {
  const verdict = run(fixture)
  if (verdict.passes !== fixture.passes) {
    const outcome = verdict.passes ? 'passed' : 'failed'
    assert.fail(`${fixture.file} unexpectedly ${outcome}: ${verdict.output.slice(-2000)}`)
  }
  if (fixture.reason !== '') {
    assert.ok(
      verdict.output.includes(fixture.reason),
      `${fixture.file} must fail with \`${fixture.reason}\``,
    )
  }
  if (fixture.control !== undefined) {
    assert.ok(
      verdict.output.includes(fixture.control),
      `${fixture.file} must pass its in-file control: \`${fixture.control}\``,
    )
  }
}

for (const fixture of fixtures) {
  nodeTest(`${fixture.file} ${fixture.passes ? 'passes' : 'fails'} in a real Vitest run`, () => {
    assertVerdict(fixture)
  }).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
}
