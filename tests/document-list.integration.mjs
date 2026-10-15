import assert from 'node:assert/strict'
import { test } from 'node:test'
import { documentListSchema } from '../src/content/contracts.ts'
import { runtime } from './runtime.mjs'

async function json(response, status = 200) {
  assert.equal(response.status, status, await response.clone().text())
  return await response.json()
}
async function list(context, query = '') {
  return documentListSchema.parse(await json(await context.fetch(`/api/admin/documents${query}`)))
}
async function create(context, title, kind = 'article') {
  const created = await json(await context.write('/api/admin/documents', { kind }), 201)
  const opened = await json(await context.fetch(`/api/admin/documents/${created.documentId}`))
  opened.document.meta.title = title
  opened.document.meta.slug = `fixture-${created.documentId}`
  return await save(context, opened)
}
async function save(context, opened) {
  return await json(await context.write(`/api/admin/documents/${opened.documentId}/revisions`, {
    expectedVersion: opened.version,
    baseRevisionId: opened.headRevisionId,
    reason: 'manual',
    document: opened.document,
  }, 'PUT'))
}
async function publish(context, document) {
  return await json(await context.write(`/api/admin/documents/${document.documentId}/publish`, {
    expectedVersion: document.version,
    expectedLiveGeneration: document.liveGeneration,
    revisionId: document.headRevisionId,
  }))
}
async function seedPages(context) {
  const seeded = []
  for (let index = 0; index < 55; index++) {
    seeded.push(await create(context, `目录分页 ${index}`))
  }
  await context.db.prepare(
    'UPDATE documents SET updated_at=? WHERE id IN (SELECT value FROM json_each(?))',
  ).bind(1700000000000, JSON.stringify(seeded.map(item => item.documentId))).run()
  return seeded.map(item => item.documentId).sort()
}
async function pagination(context) {
  const ids = await seedPages(context)
  const query = '?q=%E7%9B%AE%E5%BD%95%E5%88%86%E9%A1%B5&kind=article&state=draft'
  const first = await list(context, query)
  assert.equal(first.items.length, 50)
  assert.ok(first.nextCursor?.startsWith('v1.'))
  const next = await list(context, `${query}&cursor=${encodeURIComponent(first.nextCursor)}`)
  assert.equal(next.items.length, 5)
  assert.equal(next.nextCursor, null)
  assert.deepEqual([
    ...first.items,
    ...next.items,
  ].map(item => item.documentId), ids)
  const incompatible = await context.fetch(
    `?q=different&cursor=${encodeURIComponent(first.nextCursor)}`.replace('?', '/api/admin/documents?'),
  )
  assert.equal(incompatible.status, 400)
  const defaults = await list(context)
  assert.match(defaults.nextCursor, /^\d+:[a-f0-9-]{36}$/)
  await list(context, `?cursor=${encodeURIComponent(defaults.nextCursor)}`)
}
async function filters(context) {
  const live = await publish(context, await create(context, 'State Published'))
  const changed = await publish(context, await create(context, 'State Changed'))
  const opened = await json(await context.fetch(`/api/admin/documents/${changed.documentId}`))
  opened.document.meta.title = 'State Changed latest'
  await save(context, opened)
  const page = await create(context, 'Case Sensitive_100% \' page', 'page')
  assert.deepEqual((await list(context, '?q=state&state=published')).items.map(item => item.documentId), [
    live.documentId,
  ])
  assert.deepEqual((await list(context, '?q=State&state=changed')).items.map(item => item.documentId), [
    changed.documentId,
  ])
  assert.equal((await list(context, '?q=state&state=draft')).items.length, 0)
  assert.deepEqual((await list(context, '?q=case&kind=page')).items.map(item => item.documentId), [page.documentId])
  assert.equal((await list(context, '?q=%25')).items.length, 1)
  assert.equal((await list(context, '?q=%27%20OR%201%3D1%20--')).items.length, 0)
  for (const query of [
    '?kind=video',
    '?state=pending',
    '?q=one&q=two',
    '?unknown=1',
    `?q=${'x'.repeat(121)}`,
  ]) {
    assert.equal((await context.fetch(`/api/admin/documents${query}`)).status, 400)
  }
}
async function trash(context) {
  const document = await create(context, 'Trash restoration fixture')
  const path = `/api/admin/documents/${document.documentId}`
  const runAt = Math.ceil((Date.now() + 120000) / 60000) * 60000
  const scheduled = await json(await context.write(`${path}/schedule`, {
    expectedVersion: document.version,
    expectedLiveGeneration: document.liveGeneration,
    revisionId: document.headRevisionId,
    runAt,
    timezone: 'UTC',
    utcOffset: 0,
    localTime: new Date(runAt).toISOString().slice(0, 16),
  }), 201)
  assert.deepEqual((await list(context, '?q=Trash')).items[0].pendingSchedule, {
    revisionId: document.headRevisionId,
    runAt,
  })
  const deleted = await json(await context.write(path, {
    expectedVersion: scheduled.version,
    expectedLiveGeneration: document.liveGeneration,
  }, 'DELETE'))
  assert.equal((await context.fetch(path)).status, 404)
  assert.equal((await list(context, '?q=Trash')).items.length, 0)
  const found = await list(context, '?q=Trash&state=deleted')
  assert.equal(found.items[0].version, deleted.version)
  assert.equal(found.items[0].pendingSchedule, null)
  await restoreTrash(context, path, deleted, scheduled.scheduleId)
}
async function restoreTrash(context, path, deleted, scheduleId) {
  const body = { expectedVersion: deleted.version }
  assert.equal((await context.write(`${path}/restore-deleted`, { ...body, unexpected: true })).status, 400)
  assert.equal((await context.write(`${path}/restore-deleted`, { expectedVersion: deleted.version - 1 })).status, 409)
  await context.db.prepare('UPDATE site_state SET maintenance=1 WHERE id=1').run()
  assert.equal((await context.write(`${path}/restore-deleted`, body)).status, 503)
  await context.db.prepare('UPDATE site_state SET maintenance=0 WHERE id=1').run()
  const key = crypto.randomUUID()
  const restored = await json(await context.write(`${path}/restore-deleted`, body, 'POST', key))
  assert.deepEqual(await json(await context.write(`${path}/restore-deleted`, body, 'POST', key)), restored)
  assert.equal(restored.version, deleted.version + 1)
  assert.equal(restored.liveRevisionId, null)
  assert.equal(restored.liveGeneration, deleted.liveGeneration)
  assert.equal(restored.headRevisionId, deleted.headRevisionId)
  assert.equal((await context.write(`${path}/restore-deleted`, body)).status, 409)
  const opened = await json(await context.fetch(path))
  assert.equal(opened.livePath, null)
  assert.equal((await context.fetch(`/posts/${opened.document.meta.slug}`)).status, 404)
  assert.equal((await list(context, '?q=Trash&state=deleted')).items.length, 0)
  const draft = (await list(context, '?q=Trash&state=draft')).items[0]
  assert.equal(draft.documentId, deleted.documentId)
  assert.equal(draft.pendingSchedule, null)
  const revisions = await context.db
    .prepare('SELECT COUNT(*) AS n FROM revisions WHERE document_id=?')
    .bind(deleted.documentId)
    .first()
  assert.equal(revisions.n, 2)
  const schedule = await context.db.prepare('SELECT state FROM schedules WHERE id=?').bind(scheduleId).first()
  assert.equal(schedule.state, 'cancelled')
  assert.equal((await context.db.prepare('SELECT COUNT(*) AS n FROM txn_guards').first()).n, 0)
}

void test('admin documents search, filtered pagination and tombstone recovery use the Worker', async () => {
  const context = await runtime()
  try {
    await pagination(context)
    await filters(context)
    await trash(context)
  }
  finally {
    await context.dispose()
  }
})
