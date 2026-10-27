import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { SONNER_STYLE_HASH } from '@/server/security/toast-csp'
import { security } from '@/worker/security'

test('CSP permits only the pinned Sonner stylesheet without enabling arbitrary inline styles', async () => {
  const source = await readFile(new URL(import.meta.resolve('sonner')), 'utf8')
  const literal = /__insertCSS\(("(?:[^"\\]|\\.)*")\)/.exec(source)
  assert.ok(literal !== null && literal[1] !== undefined, 'Sonner must still have one auditable stylesheet literal')
  const css: unknown = JSON.parse(literal[1])
  assert.equal(typeof css, 'string')
  assert.ok(typeof css === 'string')
  const hash = `'sha256-${createHash('sha256').update(css).digest('base64')}'`
  assert.equal(SONNER_STYLE_HASH, hash)
  const response = security(new Response(''), { nonce: 'test-nonce', privateResponse: true, head: false })
  const policy = response.headers.get('Content-Security-Policy') ?? ''
  const style = policy.split('; ').find(value => value.startsWith('style-src '))
  assert.ok(style !== undefined)
  assert.ok(style.includes(hash))
  assert.equal(style.includes('unsafe-inline'), false)
}).catch((error: unknown) => { throw error })
