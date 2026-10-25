import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import { layerEvidenceSchema } from '~/tests/contracts/schema'

test('the native Node reporter preserves pass, skip and failure without changing the command exit', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'blog-native-evidence-'))
  t.after(async () => await rm(directory, { recursive: true, force: true }))
  const fixture = path.join(directory, 'native.fixture.mjs')
  await writeFile(fixture, `
    import { test } from 'node:test'
    test('native pass', () => {})
    test('native skip', { skip: true }, () => {})
    test('native failure', () => { throw new Error('expected reporter probe') })
  `)
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    TMPDIR: directory,
    BLOG_TEST_LAYER: 'unit',
    BLOG_VERIFICATION_RUN_ID: 'native-probe',
  }
  delete environment.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, [
    '--test',
    '--test-reporter=./tests/support/verification/node-reporter.ts',
    fixture,
  ], {
    encoding: 'utf8',
    env: environment,
  })
  assert.equal(result.status, 1, result.stderr)
  const proofs = path.join(directory, 'blog-tests/native-probe/proofs')
  const files = (await readdir(proofs)).filter(file => /^unit-[\w-]+\.json$/.test(file))
  assert.equal(files.length, 1, 'one invocation writes exactly one evidence file')
  const [file] = files
  assert.ok(file !== undefined)
  const report = layerEvidenceSchema.parse(JSON.parse(await readFile(
    path.join(proofs, file),
    'utf8',
  )))
  assert.equal(report.complete, false)
  assert.equal(report.runId, null)
  const expected = [
    ['native pass', 'passed'],
    ['native skip', 'skipped'],
    ['native failure', 'failed'],
  ]
  assert.ok(JSON.stringify(report.cases.map(entry => [entry.title, entry.status])) === JSON.stringify(expected))
}).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
