import { randomUUID } from 'node:crypto'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { verificationRoot } from './paths'
import { sourceIdentity } from './source'

async function prepare(): Promise<void> {
  await mkdir(verificationRoot, { recursive: true })
  // A reporter reads this manifest while it runs, so it is replaced by rename: a
  // concurrent reader sees one whole manifest, never a half-written one.
  const pending = path.join(verificationRoot, `run.json.${randomUUID()}.tmp`)
  await writeFile(pending, JSON.stringify({
    id: randomUUID(),
    ...sourceIdentity(),
  }, null, 2))
  await rename(pending, path.join(verificationRoot, 'run.json'))
}
prepare().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
