import type { SourceIdentity } from '~/tests/contracts/types'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { z } from 'zod'

export const verificationRoot = path.join(
  tmpdir(),
  'blog-tests',
  process.env.BLOG_VERIFICATION_RUN_ID ?? process.env.BLOG_TEST_RUN_ID ?? 'verification',
  'proofs',
)

const runSchema = z.strictObject({
  id: z.uuid(),
  revision: z.string().min(1),
  fingerprint: z.string().min(1),
})

export function currentRun(): (SourceIdentity & { id: string }) | null {
  try {
    return runSchema.parse(JSON.parse(readFileSync(path.join(verificationRoot, 'run.json'), 'utf8')))
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}
