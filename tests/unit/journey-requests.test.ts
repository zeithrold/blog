import type { MediaCloneProof } from '~/tests/support/browser/journey-requests'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { consumeDragCancellation } from '~/tests/support/browser/journey-requests'

const url = 'http://127.0.0.1:8801/api/admin/assets/11111111-1111-4111-8111-111111111111/content'
const failure = { page: 'editor', url, at: 15, method: 'GET', message: 'cancelled' }
function proof(): MediaCloneProof {
  return {
    page: 'editor',
    from: 10,
    until: 20,
    resources: [
      { url, at: 12, detached: true, sourceConnected: true, sourceError: null, remaining: 1 },
    ],
  }
}

test('drag cancellation exemption consumes only the observed clone count', () => {
  const evidence = [
    proof(),
  ]
  assert.equal(consumeDragCancellation(failure, evidence), true)
  assert.equal(consumeDragCancellation(failure, evidence), false)
  assert.equal(consumeDragCancellation({ ...failure, message: 'net::ERR_ABORTED' }, [
    proof(),
  ]), true)
}).catch((error: unknown) => { throw error })

test('missing, unrelated or out-of-window drag evidence never hides failed requests', () => {
  assert.equal(consumeDragCancellation(failure, []), false)
  for (const change of [
    { page: 'reader' },
    { at: 9 },
    { at: 11 },
    { at: 21 },
    { url: url.replace('11111111-', '22222222-') },
    { method: 'PUT' },
    { method: 'POST' },
    { message: 'net::ERR_CONNECTION_RESET' },
    { message: 'HTTP 503' },
  ]) {
    assert.equal(consumeDragCancellation({ ...failure, ...change }, [
      proof(),
    ]), false, JSON.stringify(change))
  }
}).catch((error: unknown) => { throw error })

test('a connected clone or broken original media cannot justify cancellation', () => {
  for (const change of [
    { detached: false },
    { sourceConnected: false },
    { sourceError: 3 },
  ]) {
    const evidence = proof()
    evidence.resources = evidence.resources.map(resource => ({ ...resource, ...change }))
    assert.equal(consumeDragCancellation(failure, [evidence]), false, JSON.stringify(change))
  }
}).catch((error: unknown) => { throw error })

test('even a matching proof cannot exempt non-asset URLs', () => {
  const unrelated = 'http://127.0.0.1:8801/api/admin/documents'
  const evidence = proof()
  evidence.resources = evidence.resources.map(resource => ({ ...resource, url: unrelated }))
  assert.equal(consumeDragCancellation({ ...failure, url: unrelated }, [evidence]), false)
}).catch((error: unknown) => { throw error })
