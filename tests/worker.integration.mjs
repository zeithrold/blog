import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runtime } from './runtime.mjs'

test('built Worker: private boundaries, head/live isolation, CAS, replay, immutable history and FTS', async (t) => {
  const app = await runtime()
  t.after(() => app.dispose())
  const state = { app }
  await t.test(
    'missing JWT/invalid host/encoded paths/Origin and CSRF fail closed',
    async () => await check1(state),
  )
  await t.test(
    'valid signatures still require the exact issuer, audience, owner and app type',
    async () => await check2(state),
  )
  const creation = await app.write('/api/admin/documents', {})
  assert.equal(creation.status, 201)
  state.ack = await creation.json()
  const id = state.ack.documentId
  const url = `/api/admin/documents/${id}`
  const document = (await (await app.fetch(url)).json()).document
  document.meta.title = 'Concurrency 中文搜索'
  document.meta.slug = 'concurrency'
  document.blocks[0].content = [
    {
      type: 'text',
      text: 'Hello live ERR_CONNECTION_RESET 中文搜索',
      styles: {},
    },
  ]
  Object.assign(state, { id, url, document })
  await t.test(
    'two saves at one base commit only one revision and leave no orphan/guard',
    async () => await check3(state),
  )
  const key = crypto.randomUUID()
  const publication = {
    expectedVersion: state.ack.version,
    expectedLiveGeneration: state.ack.liveGeneration,
    revisionId: state.ack.headRevisionId,
  }
  Object.assign(state, { key, publication })
  await t.test(
    'unknown response replay publishes once; reused key with different body rejects',
    async () => await check4(state),
  )
  await t.test(
    'draft saves do not alter live bytes or leak into search; restore creates a new head',
    async () => await check5(state),
  )
  await t.test(
    'unchanged snapshots do not grow history; invalid JSON and maintenance do not write',
    async () => await check6(state),
  )
  await t.test(
    'unpublish removes public SSR and FTS atomically',
    async () => await check7(state),
  )
})

async function check1(state) {
  const { app } = state
  for (const route of [
    '/admin',
    '/api/admin/session',
    '/admin/preview/a/b',
  ]) {
    assert.equal((await app.fixture.dispatchFetch(app.origin + route)).status, 401)
    assert.equal(
      (
        await app.fixture.dispatchFetch(app.origin + route, {
          method: 'HEAD',
        })
      ).status,
      401,
    )
  }
  assert.equal((await app.fixture.dispatchFetch('https://evil.test/api/health')).status, 403)
  assert.equal((await app.fetch('/%61dmin')).status, 400)
  assert.equal(
    (
      await app.fetch('/api/admin/documents', {
        method: 'POST',
        headers: {
          'origin': 'https://evil.test',
          'content-type': 'application/json',
        },
        body: '{}',
      })
    ).status,
    403,
  )
  assert.equal(
    (
      await app.fetch('/api/admin/documents', {
        method: 'POST',
        headers: { 'origin': app.origin, 'content-type': 'application/json' },
        body: '{}',
      })
    ).status,
    403,
  )
}
async function check2(state) {
  const { app } = state
  for (const claims of [
    { aud: 'other-audience' },
    { iss: 'https://other.cloudflareaccess.com' },
    { exp: Math.floor(Date.now() / 1000) - 60 },
    { type: 'org' },
  ]) {
    const token = await app.jwt(claims)
    assert.equal(
      (
        await app.fetch('/api/admin/session', {
          headers: { 'cf-access-jwt-assertion': token },
        })
      ).status,
      401,
    )
  }
  const outsider = await app.jwt({ sub: 'other-owner' })
  assert.equal(
    (
      await app.fetch('/api/admin/session', {
        headers: { 'cf-access-jwt-assertion': outsider },
      })
    ).status,
    403,
  )
}
async function check3(state) {
  const { app, id, url, document } = state
  const body = {
    expectedVersion: state.ack.version,
    baseRevisionId: state.ack.headRevisionId,
    reason: 'manual',
    document,
  }
  const race = await Promise.all([
    app.write(`${url}/revisions`, body, 'PUT'),
    app.write(`${url}/revisions`, body, 'PUT'),
  ])
  assert.deepEqual(race.map(response => response.status).sort(), [200, 409])
  state.ack = await race.find(response => response.status === 200).json()
  assert.equal(
    (
      await app.db
        .prepare('SELECT COUNT(*) AS n FROM revisions WHERE document_id=?')
        .bind(id)
        .first()
    ).n,
    2,
  )
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM txn_guards').first()).n, 0)
  assert.equal((await app.fetch('/posts/concurrency')).status, 404)
}
async function check4(state) {
  const { app, id, url, key, publication } = state
  const first = await app.write(`${url}/publish`, publication, 'POST', key)
  assert.equal(first.status, 200, await first.clone().text())
  state.ack = await first.json()
  assert.deepEqual(
    await (await app.write(`${url}/publish`, publication, 'POST', key)).json(),
    state.ack,
  )
  assert.equal(
    (await app.write(`${url}/publish`, { ...publication, expectedVersion: 9 }, 'POST', key))
      .status,
    409,
  )
  assert.equal(
    (
      await app.db
        .prepare('SELECT COUNT(*) AS n FROM publication_events WHERE document_id=?')
        .bind(id)
        .first()
    ).n,
    1,
  )
  assert.equal((await app.fetch('/posts/concurrency')).status, 200)
  for (const q of [
    'ERR_CONNECTION_RESET',
    '中文搜索',
    '中文',
  ]) {
    assert.equal(
      (await (await app.fetch(`/api/search?q=${encodeURIComponent(q)}`)).json()).items.length,
      1,
    )
  }
}
async function check5(state) {
  const { app, url, document } = state
  const live = await (await app.fetch('/posts/concurrency')).text()
  document.blocks[0].content[0].text = 'DRAFT_SECRET'
  const save = await app.write(
    `${url}/revisions`,
    {
      expectedVersion: state.ack.version,
      baseRevisionId: state.ack.headRevisionId,
      reason: 'autosave',
      document,
    },
    'PUT',
  )
  assert.equal(save.status, 200)
  const before = state.ack
  state.ack = await save.json()
  assert.ok((await (await app.fetch('/posts/concurrency')).text()).includes('Hello live'))
  assert.ok(live.includes('Hello live'))
  assert.equal((await (await app.fetch('/api/search?q=DRAFT_SECRET')).json()).items.length, 0)
  const restored = await app.write(`${url}/restore`, {
    expectedVersion: state.ack.version,
    revisionId: before.headRevisionId,
  })
  assert.equal(restored.status, 201)
  const result = await restored.json()
  assert.notEqual(result.headRevisionId, before.headRevisionId)
  assert.equal(result.liveRevisionId, before.liveRevisionId)
  state.ack = result
}
async function check6(state) {
  const { app, id, url } = state
  const open = await (await app.fetch(url)).json()
  const before = (await app.db.prepare('SELECT COUNT(*) AS n FROM revisions').first()).n
  const result = await app.write(
    `${url}/revisions`,
    {
      expectedVersion: state.ack.version,
      baseRevisionId: state.ack.headRevisionId,
      reason: 'autosave',
      document: open.document,
    },
    'PUT',
  )
  assert.equal((await result.json()).unchanged, true)
  assert.equal(
    (await app.db.prepare('SELECT COUNT(*) AS n FROM revisions').first()).n,
    before,
  )
  await app.db.prepare('UPDATE site_state SET maintenance=1').run()
  assert.equal(
    (
      await app.write(`${url}/unpublish`, {
        expectedVersion: state.ack.version,
        expectedLiveGeneration: state.ack.liveGeneration,
      })
    ).status,
    503,
  )
  assert.equal((await app.fetch('/posts/concurrency')).status, 200)
  await app.db.prepare('UPDATE site_state SET maintenance=0').run()
  await assert.rejects(
    app.db.prepare('DELETE FROM revisions WHERE document_id=?').bind(id).run(),
    /IMMUTABLE_REVISION/,
  )
}
async function check7(state) {
  const { app, url } = state
  const response = await app.write(`${url}/unpublish`, {
    expectedVersion: state.ack.version,
    expectedLiveGeneration: state.ack.liveGeneration,
  })
  assert.equal(response.status, 200)
  assert.equal((await app.fetch('/posts/concurrency')).status, 404)
  assert.equal((await (await app.fetch('/api/search?q=中文')).json()).items.length, 0)
  assert.equal((await app.db.prepare('PRAGMA foreign_key_check').all()).results.length, 0)
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM txn_guards').first()).n, 0)
}
