import type { Document } from '@/content/document'
import type { Runtime } from '~/tests/support/worker/runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'
import { acknowledgementSchema, openDocumentSchema } from '@/contracts/documents'
import { deepEqual, equal } from '~/tests/support/unit/assertions'
import { runtime } from '~/tests/support/worker/runtime'

type AuthState = { app: Runtime }
type DocumentState = AuthState & {
  ack: ReturnType<typeof acknowledgementSchema.parse>
  id: string
  url: string
  document: Document
}
type PublicationState = DocumentState & {
  key: string
  publication: { expectedVersion: number, expectedLiveGeneration: number, revisionId: string }
}
const searchResults = z.object({ items: z.array(z.unknown()) })

test('built Worker: private boundaries, head/live isolation, CAS, replay, immutable history and FTS', async (t) => {
  const app = await runtime()
  t.after(async () => await app.dispose())
  const authState = { app }
  await t.test(
    'missing JWT/invalid host/encoded paths/Origin and CSRF fail closed',
    async () => await check1(authState),
  )
  const creation = await app.write('/api/admin/documents', {})
  equal(creation.status, 201)
  const ack = acknowledgementSchema.parse(await creation.json())
  const id = ack.documentId
  const url = `/api/admin/documents/${id}`
  const document = openDocumentSchema.parse(await (await app.fetch(url)).json()).document
  document.meta.title = 'Concurrency 中文搜索'
  document.meta.slug = 'concurrency'
  const paragraph = document.blocks[0]
  assert.ok(paragraph !== undefined)
  paragraph.content = [
    {
      type: 'text',
      text: 'Hello live ERR_CONNECTION_RESET 中文搜索',
      styles: {},
    },
  ]
  const state = { app, ack, id, url, document }
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
  const publicationState = { ...state, key, publication }
  await t.test(
    'unknown response replay publishes once; reused key with different body rejects',
    async () => await check4(publicationState),
  )
  await t.test(
    'draft saves do not alter live bytes or leak into search; restore creates a new head',
    async () => await check5(publicationState),
  )
  await t.test(
    'unchanged snapshots do not grow history; invalid JSON and maintenance do not write',
    async () => await check6(publicationState),
  )
  await t.test(
    'unpublish removes public SSR and FTS atomically',
    async () => await check7(publicationState),
  )
}).catch((error: unknown) => { throw error })

async function check1(state: AuthState) {
  const { app } = state
  for (const route of [
    '/admin',
    '/api/admin/session',
    '/admin/preview/a/b',
  ]) {
    equal((await app.fixture.dispatchFetch(app.origin + route)).status, 401)
    equal(
      (
        await app.fixture.dispatchFetch(app.origin + route, {
          method: 'HEAD',
        })
      ).status,
      401,
    )
  }
  equal((await app.fixture.dispatchFetch('https://evil.test/api/health')).status, 403)
  equal((await app.fetch('/%61dmin')).status, 400)
  equal(
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
  equal(
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
async function check3(state: DocumentState) {
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
  deepEqual(race.map(response => response.status).sort((left, right) => left - right), [200, 409])
  const winner = race.find(response => response.status === 200)
  assert.ok(winner !== undefined)
  state.ack = acknowledgementSchema.parse(await winner.json())
  equal(
    (
      await app.db
        .prepare('SELECT COUNT(*) AS n FROM revisions WHERE document_id=?')
        .bind(id)
        .first<{ n: number }>()
    )?.n,
    2,
  )
  equal((await count(app.db.prepare('SELECT COUNT(*) AS n FROM txn_guards').first<{ n: number }>())).n, 0)
  equal((await app.fetch('/posts/concurrency')).status, 404)
}
async function check4(state: PublicationState) {
  const { app, id, url, key, publication } = state
  const first = await app.write(`${url}/publish`, publication, 'POST', key)
  equal(first.status, 200, await first.clone().text())
  state.ack = acknowledgementSchema.parse(await first.json())
  deepEqual(
    await (await app.write(`${url}/publish`, publication, 'POST', key)).json(),
    state.ack,
  )
  equal(
    (await app.write(`${url}/publish`, { ...publication, expectedVersion: 9 }, 'POST', key))
      .status,
    409,
  )
  equal(
    (
      await app.db
        .prepare('SELECT COUNT(*) AS n FROM publication_events WHERE document_id=?')
        .bind(id)
        .first<{ n: number }>()
    )?.n,
    1,
  )
  equal((await app.fetch('/posts/concurrency')).status, 200)
  for (const q of [
    'ERR_CONNECTION_RESET',
    '中文搜索',
    '中文',
  ]) {
    equal(
      searchResults.parse(await (await app.fetch(`/api/search?q=${encodeURIComponent(q)}`)).json()).items.length,
      1,
    )
  }
}
async function check5(state: DocumentState) {
  const { app, url, document } = state
  const live = await (await app.fetch('/posts/concurrency')).text()
  const paragraph = document.blocks[0]
  assert.ok(paragraph !== undefined && 'content' in paragraph && Array.isArray(paragraph.content))
  const text = paragraph.content[0]
  assert.ok(text?.type === 'text')
  text.text = 'DRAFT_SECRET'
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
  equal(save.status, 200)
  const before = state.ack
  state.ack = acknowledgementSchema.parse(await save.json())
  assert.ok((await (await app.fetch('/posts/concurrency')).text()).includes('Hello live'))
  assert.ok(live.includes('Hello live'))
  equal(searchResults.parse(await (await app.fetch('/api/search?q=DRAFT_SECRET')).json()).items.length, 0)
  const restored = await app.write(`${url}/restore`, {
    expectedVersion: state.ack.version,
    revisionId: before.headRevisionId,
  })
  equal(restored.status, 201)
  const result = acknowledgementSchema.parse(await restored.json())
  assert.notEqual(result.headRevisionId, before.headRevisionId)
  equal(result.liveRevisionId, before.liveRevisionId)
  state.ack = result
}
async function check6(state: DocumentState) {
  const { app, id, url } = state
  const open = openDocumentSchema.parse(await (await app.fetch(url)).json())
  const before = (await count(app.db.prepare('SELECT COUNT(*) AS n FROM revisions').first<{ n: number }>())).n
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
  equal(acknowledgementSchema.parse(await result.json()).unchanged, true)
  equal(
    (await count(app.db.prepare('SELECT COUNT(*) AS n FROM revisions').first<{ n: number }>())).n,
    before,
  )
  await app.db.prepare('UPDATE site_state SET maintenance=1').run()
  equal(
    (
      await app.write(`${url}/unpublish`, {
        expectedVersion: state.ack.version,
        expectedLiveGeneration: state.ack.liveGeneration,
      })
    ).status,
    503,
  )
  equal((await app.fetch('/posts/concurrency')).status, 200)
  await app.db.prepare('UPDATE site_state SET maintenance=0').run()
  await assert.rejects(
    app.db.prepare('DELETE FROM revisions WHERE document_id=?').bind(id).run(),
    /IMMUTABLE_REVISION/,
  )
}
async function check7(state: DocumentState) {
  const { app, url } = state
  const response = await app.write(`${url}/unpublish`, {
    expectedVersion: state.ack.version,
    expectedLiveGeneration: state.ack.liveGeneration,
  })
  equal(response.status, 200)
  equal((await app.fetch('/posts/concurrency')).status, 404)
  equal(searchResults.parse(await (await app.fetch('/api/search?q=中文')).json()).items.length, 0)
  equal((await app.db.prepare('PRAGMA foreign_key_check').all()).results.length, 0)
  equal((await count(app.db.prepare('SELECT COUNT(*) AS n FROM txn_guards').first<{ n: number }>())).n, 0)
}

async function count(result: Promise<{ n: number } | null>): Promise<{ n: number }> {
  const row = await result
  assert.ok(row !== null)
  return row
}
