import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runtime } from '~/tests/support/worker/runtime'

test('built HTML is served as the router rendered it, still under the response nonce', async (t) => {
  const app = await runtime()
  t.after(async () => await app.dispose())
  const response = await app.fetch('/admin/documents')
  assert.equal(response.status, 200)
  const policy = response.headers.get('content-security-policy') ?? ''
  const nonce = /'nonce-([^']+)'/u.exec(policy)?.[1]
  assert.ok(nonce !== undefined)
  assert.match(policy, /script-src 'self' 'nonce-/u)
  const html = await response.text()
  // The Worker adds no pre-hydration script: no history state stamping, no
  // injected pop listener and no worker-owned navigation state.
  assert.doesNotMatch(html, /__blogHistory|blog:history-pop|blog:history-write/u)
  const health = await app.fetch('/api/health')
  assert.match(health.headers.get('content-type') ?? '', /application\/json/u)
  assert.doesNotMatch(await health.text(), /<script/u)
  const head = await app.fetch('/admin/documents', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
}).catch((error: unknown) => {
  throw error
})
