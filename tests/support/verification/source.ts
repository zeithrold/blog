import type { SourceIdentity } from '~/tests/contracts/types'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

export function sourceIdentity(): SourceIdentity {
  const files = execFileSync('git', [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  ], {
    encoding: 'utf8',
  })
  const hash = createHash('sha256')
  for (const file of Array.from(new Set(files.split('\0').filter(Boolean))).sort()) {
    hash.update(file).update(existsSync(file) ? readFileSync(file) : 'missing')
  }
  return {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    fingerprint: hash.digest('hex'),
  }
}
