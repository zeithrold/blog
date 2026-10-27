import type { Runtime } from '~/tests/support/worker/runtime'
import { test } from 'node:test'
import { acknowledgementSchema } from '@/contracts/documents'
import { sessionSchema } from '@/contracts/session'
import { equal } from '~/tests/support/unit/assertions'
import { runtime } from '~/tests/support/worker/runtime'

test('Access policy admission replaces the owner allowlist without weakening JWT or CSRF validation', async (t) => {
  // The fixture deliberately has no OWNER_SUBS configuration.
  const app = await runtime()
  t.after(async () => await app.dispose())
  await rejectInvalidTokens(app)
  await admitSecondAdmin(app)
}).catch((error: unknown) => { throw error })

async function rejectInvalidTokens(app: Runtime): Promise<void> {
  for (const claims of [
    { aud: 'other-audience' },
    { iss: 'https://other.cloudflareaccess.com' },
    { exp: Math.floor(Date.now() / 1000) - 60 },
    { type: 'org' },
    { type: 'service', sub: '' },
    { sub: '' },
  ]) {
    await refuse(app, await app.jwt(claims))
  }
  const token = await app.jwt()
  const signature = token.lastIndexOf('.') + 1
  const forged = `${token.slice(0, signature)}${token[signature] === 'A' ? 'B' : 'A'}${token.slice(signature + 1)}`
  await refuse(app, forged)
  await refuse(app, 'not-a-jwt')
}

async function refuse(app: Runtime, token: string): Promise<void> {
  for (const path of [
    '/api/admin/session',
    '/admin',
    '/admin/preview/a/b',
  ]) {
    equal((await app.fetch(path, { headers: { 'cf-access-jwt-assertion': token } })).status, 401)
  }
}

async function admitSecondAdmin(app: Runtime): Promise<void> {
  const token = await app.jwt({ sub: 'second-admin' })
  const identity = { 'cf-access-jwt-assertion': token }
  const response = await app.fetch('/api/admin/session', { headers: identity })
  equal(response.status, 200)
  const session = sessionSchema.parse(await response.json())
  equal(session.ownerSub, 'second-admin')
  equal((await app.fetch('/admin', { headers: identity })).status, 200)
  const write = async (csrfToken: string) => await app.fetch('/api/admin/documents', {
    method: 'POST',
    headers: {
      ...identity,
      'origin': app.origin,
      'content-type': 'application/json',
      'idempotency-key': crypto.randomUUID(),
      'x-csrf-token': csrfToken,
    },
    body: '{}',
  })
  equal((await write(app.csrfToken)).status, 403)
  const created = await write(session.csrfToken)
  equal(created.status, 201)
  const acknowledgement = acknowledgementSchema.parse(await created.json())
  const revision = await app.db.prepare('SELECT actor_sub FROM revisions WHERE document_id=? AND sequence=1')
    .bind(acknowledgement.documentId)
    .first<{ actor_sub: string }>()
  equal(revision?.actor_sub, 'second-admin')
}
