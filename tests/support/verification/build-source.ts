import type { Plugin } from 'vite'
import type { SourceIdentity } from '~/tests/contracts/types'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { z } from 'zod'
import { sourceIdentity } from './source'

// Verification reports describe the checkout they run against. The built runtime is a
// separate, ignored artifact, so a build must record the source it was produced from next
// to its output; otherwise a stale `dist` is loaded while the report names newer source.
export const buildSourceFileName = 'test-source.json'

// Each environment needs its own receipt: a successful server/client build cannot relabel
// an older SSR child after a partial build failure. The client receipt is a served asset;
// it holds only the revision and source fingerprint, never credentials.
export const buildSourceDirectories = [
  'dist/server',
  'dist/client',
  'dist/server/ssr',
] as const

const manifestSchema = z.strictObject({
  revision: z.string().min(1),
  fingerprint: z.string().min(1),
})

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function readManifest(label: string, file: string): SourceIdentity {
  let content: string
  try {
    content = readFileSync(file, 'utf8')
  }
  catch (error) {
    if (isMissingFile(error)) {
      throw new Error(
        `${label} is missing, so the built runtime cannot prove it matches this checkout. `
        + 'Run `pnpm build` before loading built output.',
      )
    }
    throw error
  }
  try {
    return manifestSchema.parse(JSON.parse(content))
  }
  catch (error) {
    const reason = error instanceof Error ? error.message : 'unreadable content'
    throw new Error(`${label} is not a build source manifest: ${reason}`)
  }
}

// Loading a stale build is the failure this manifest prevents, so the runtime fixture calls
// this before it resolves or evaluates any module.
export function verifyBuildSource(
  identity: SourceIdentity = sourceIdentity(),
  root: string = process.cwd(),
): void {
  for (const directory of buildSourceDirectories) {
    const label = `${directory}/${buildSourceFileName}`
    const built = readManifest(label, path.resolve(root, directory, buildSourceFileName))
    if (built.revision !== identity.revision || built.fingerprint !== identity.fingerprint) {
      throw new Error(
        `${label} was built from ${built.revision} (${built.fingerprint}), but this checkout is `
        + `${identity.revision} (${identity.fingerprint}). The built runtime is stale; rerun `
        + '`pnpm build`.',
      )
    }
  }
}

// The manifest is an emitted asset, so it is written only with the bundle that carries it:
// no separate stamp command can label a build that failed or never ran. Every environment,
// including the nested SSR bundle, reports the same captured identity.
export function buildSourceAsset(
  identity: SourceIdentity,
): { type: 'asset', fileName: string, source: string } {
  return {
    type: 'asset',
    fileName: buildSourceFileName,
    source: `${JSON.stringify(identity, null, 2)}\n`,
  }
}

// Vite re-creates plugins for each environment but keeps this closure, so the identity
// captured when the build starts is shared by every environment of that build.
export function buildSource(options: { identity?: SourceIdentity } = {}): Plugin {
  let identity = options.identity
  // Capture the source once, so every environment of this build reports the same snapshot.
  function capture(): SourceIdentity {
    identity ??= sourceIdentity()
    return identity
  }
  return {
    name: 'blog:test-build-source',
    apply: 'build',
    buildStart() {
      capture()
    },
    generateBundle() {
      this.emitFile(buildSourceAsset(capture()))
    },
  }
}
