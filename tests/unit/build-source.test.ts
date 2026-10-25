import type { TestContext } from 'node:test'
import type { SourceIdentity } from '~/tests/contracts/types'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  buildSourceAsset,
  buildSourceDirectories,
  buildSourceFileName,
  verifyBuildSource,
} from '~/tests/support/verification/build-source'

const identity: SourceIdentity = { revision: 'source-commit', fingerprint: 'source-fingerprint' }
const stale: SourceIdentity = { revision: 'previous-commit', fingerprint: 'previous-fingerprint' }

async function fixture(t: TestContext): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'blog-build-source-'))
  t.after(async () => await rm(root, { recursive: true, force: true }))
  return root
}

async function writeManifest(
  root: string,
  directory: string,
  manifest: SourceIdentity | string,
): Promise<void> {
  const file = path.join(root, directory, buildSourceFileName)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, typeof manifest === 'string' ? manifest : JSON.stringify(manifest))
}

function rejects(predicate: (message: string) => boolean) {
  return (error: unknown): boolean => error instanceof Error && predicate(error.message)
}

test('built output whose manifests match the checkout is accepted', async (t) => {
  const root = await fixture(t)
  for (const directory of buildSourceDirectories) {
    await writeManifest(root, directory, identity)
  }
  assert.doesNotThrow(() => verifyBuildSource(identity, root))
}).catch((error: unknown) => { throw error })

test('a manifest missing from any runtime artifact root rejects the build', async (t) => {
  for (const directory of buildSourceDirectories) {
    const root = await fixture(t)
    for (const other of buildSourceDirectories) {
      await writeManifest(root, other, identity)
    }
    await rm(path.join(root, directory, buildSourceFileName))
    assert.throws(
      () => verifyBuildSource(identity, root),
      rejects(message => message.includes(`${directory}/${buildSourceFileName} is missing`)),
    )
  }
}).catch((error: unknown) => { throw error })

test('a stale manifest in any runtime artifact root rejects the build', async (t) => {
  for (const directory of buildSourceDirectories) {
    const root = await fixture(t)
    for (const other of buildSourceDirectories) {
      await writeManifest(root, other, other === directory ? stale : identity)
    }
    assert.throws(
      () => verifyBuildSource(identity, root),
      rejects(message => message.includes(`${directory}/${buildSourceFileName} was built from ${stale.revision}`)
        && message.includes(`this checkout is ${identity.revision}`)),
    )
  }
}).catch((error: unknown) => { throw error })

test('an unreadable manifest rejects the build instead of guessing', async (t) => {
  const root = await fixture(t)
  await writeManifest(root, 'dist/server', identity)
  await writeManifest(root, 'dist/client', '{"revision":"source-commit"}')
  assert.throws(
    () => verifyBuildSource(identity, root),
    rejects(message => message.includes(`dist/client/${buildSourceFileName} is not a build source manifest`)),
  )
}).catch((error: unknown) => { throw error })

test('the build emits the captured identity with every environment bundle', () => {
  const asset = buildSourceAsset(identity)
  assert.equal(asset.fileName, buildSourceFileName)
  assert.deepEqual(JSON.parse(asset.source), identity)
}).catch((error: unknown) => { throw error })
