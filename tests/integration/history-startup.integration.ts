import assert from 'node:assert/strict'
import { test } from 'node:test'
import { equal } from '~/tests/support/unit/assertions'
import { runtime } from '~/tests/support/worker/runtime'

test('built HTML installs the history bridge before router scripts under its response nonce', async (t) => {
  const app = await runtime()
  t.after(async () => await app.dispose())
  const response = await app.fetch('/admin/documents')
  assert.equal(response.status, 200)
  const policy = response.headers.get('content-security-policy') ?? ''
  const nonce = /'nonce-([^']+)'/u.exec(policy)?.[1]
  assert.ok(nonce !== undefined)
  const html = await response.text()
  const script = /<head[^>]*>\s*<script\s+nonce="([^"]+)">([\s\S]*?)<\/script>/u.exec(html)
  assert.ok(script !== null)
  assert.equal(script[1], nonce)
  assert.match(String(script[2]), /const key = '__blogHistory'/u)
  equal(html.indexOf('<script'), script.index + script[0].indexOf('<script'))
  assert.equal(response.headers.get('content-length'), null)
  const health = await app.fetch('/api/health')
  assert.match(health.headers.get('content-type') ?? '', /application\/json/u)
  assert.doesNotMatch(await health.text(), /<script/u)
  const head = await app.fetch('/admin/documents', { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
}).catch((error: unknown) => {
  throw error
})
