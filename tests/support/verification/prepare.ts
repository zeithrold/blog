import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { verificationRoot } from './paths'
import { sourceIdentity } from './source'

async function prepare(): Promise<void> {
  await mkdir(verificationRoot, { recursive: true })
  await writeFile(path.join(verificationRoot, 'run.json'), JSON.stringify({
    id: randomUUID(),
    ...sourceIdentity(),
  }, null, 2))
}
prepare().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
