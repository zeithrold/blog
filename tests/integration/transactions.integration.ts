import type { acknowledgementSchema } from '@/contracts/documents'
import type { Runtime } from '~/tests/support/worker/runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openDocumentSchema } from '@/contracts/documents'
import { scheduleAckSchema } from '@/contracts/publication'
import { deepEqual, equal } from '~/tests/support/unit/assertions'
import { json } from '~/tests/support/worker/responses'
import { runtime } from '~/tests/support/worker/runtime'

async function current(context: Runtime, id: string) {
  return await json(await context.fetch(`/api/admin/documents/${id}`), 200, openDocumentSchema)
}
async function save(
  context: Runtime,
  opened: ReturnType<typeof openDocumentSchema.parse>,
  title: string,
  key: string = crypto.randomUUID(),
) {
  opened.document.meta.title = title
  opened.document.meta.slug = 'transaction-fixture'
  return await context.write(
    `/api/admin/documents/${opened.documentId}/revisions`,
    {
      expectedVersion: opened.version,
      baseRevisionId: opened.headRevisionId,
      reason: 'manual',
      document: opened.document,
    },
    'PUT',
    key,
  )
}
async function state(context: Runtime) {
  const guards = await context.db.prepare('SELECT COUNT(*) AS n FROM txn_guards').first<{ n: number }>()
  assert.ok(guards !== null)
  equal(guards.n, 0)
  equal((await context.db.prepare('PRAGMA foreign_key_check').all()).results.length, 0)
  const orphan = await context.db
    .prepare(
      `SELECT COUNT(*) AS n FROM revisions r
    LEFT JOIN documents d ON d.id=r.document_id WHERE d.id IS NULL`,
    )
    .first<{ n: number }>()
  assert.ok(orphan !== null)
  equal(orphan.n, 0)
  const drift = await context.db
    .prepare(
      `SELECT COUNT(*) AS n FROM published_documents p
    JOIN documents d ON d.id=p.document_id WHERE d.live_revision_id<>p.revision_id OR d.deleted_at IS NOT NULL`,
    )
    .first<{ n: number }>()
  assert.ok(drift !== null)
  equal(drift.n, 0)
}
async function mixedRound(context: Runtime, id: string, round: number) {
  const first = await current(context, id)
  const left = structuredClone(first)
  const right = structuredClone(first)
  const competing = await Promise.all([
    save(context, left, `Round ${round} left`),
    save(context, right, `Round ${round} right`),
  ])
  deepEqual(competing.map(response => response.status).sort((a, b) => a - b), [200, 409])
  const after = await current(context, id)
  const operation = round % 3 === 0 ? 'unpublish' : 'publish'
  const payload = {
    expectedVersion: after.version,
    expectedLiveGeneration: after.liveGeneration,
    ...(operation === 'publish' ? { revisionId: after.headRevisionId } : {}),
  }
  const key = crypto.randomUUID()
  const path = `/api/admin/documents/${id}/${operation}`
  const writes = await Promise.all([
    context.write(path, payload, 'POST', key),
    context.write(path, payload, 'POST', key),
  ])
  const ack = await json(writes[0])
  deepEqual(await json(writes[1]), ack)
  const replay = await json(await context.write(path, payload, 'POST', key))
  deepEqual(replay, ack)
  await state(context)
}
test('200 racing mutations preserve atomic state and exact replay', async () => {
  const context = await runtime()
  try {
    const created = await json(await context.write('/api/admin/documents', {}), 201)
    for (let round = 0; round < 40; round++) {
      await mixedRound(context, created.documentId, round)
    }
    const duplicates = await context.db
      .prepare(
        `SELECT COUNT(*) AS n FROM (
      SELECT document_id,live_generation,COUNT(*) AS count FROM publication_events
      GROUP BY document_id,live_generation HAVING COUNT(*)>1)`,
      )
      .first<{ n: number }>()
    assert.ok(duplicates !== null)
    equal(duplicates.n, 0)
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })
test('soft delete compares versions, retains history and cancels jobs', async () => {
  const context = await runtime()
  try {
    await deletionFlow(context)
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })
async function deletionFlow(context: Runtime) {
  const created = await json(await context.write('/api/admin/documents', {}), 201)
  const opened = await current(context, created.documentId)
  const saved = await json(await save(context, opened, 'Delete fixture'))
  const live = await json(
    await context.write(`/api/admin/documents/${created.documentId}/publish`, {
      expectedVersion: saved.version,
      expectedLiveGeneration: saved.liveGeneration,
      revisionId: saved.headRevisionId,
    }),
  )
  const path = `/api/admin/documents/${created.documentId}`
  equal(
    (
      await context.write(
        path,
        { expectedVersion: live.version, expectedLiveGeneration: live.liveGeneration },
        'DELETE',
      )
    ).status,
    409,
  )
  const draft = await json(
    await context.write(`${path}/unpublish`, {
      expectedVersion: live.version,
      expectedLiveGeneration: live.liveGeneration,
    }),
  )
  equal(
    (
      await context.write(
        path,
        { expectedVersion: draft.version, expectedLiveGeneration: live.liveGeneration },
        'DELETE',
      )
    ).status,
    409,
  )
  await removeScheduled(context, path, draft, created.documentId)
}
async function removeScheduled(
  context: Runtime,
  path: string,
  draft: ReturnType<typeof acknowledgementSchema.parse>,
  documentId: string,
) {
  const runAt = Math.ceil((Date.now() + 120000) / 60000) * 60000
  const scheduled = await json(
    await context.write(`${path}/schedule`, {
      expectedVersion: draft.version,
      expectedLiveGeneration: draft.liveGeneration,
      revisionId: draft.headRevisionId,
      runAt,
      timezone: 'UTC',
      utcOffset: 0,
      localTime: new Date(runAt).toISOString().slice(0, 16),
    }),
    201,
    scheduleAckSchema,
  )
  const payload = {
    expectedVersion: scheduled.version,
    expectedLiveGeneration: draft.liveGeneration,
  }
  const key = crypto.randomUUID()
  const removed = await json(await context.write(path, payload, 'DELETE', key))
  deepEqual(await json(await context.write(path, payload, 'DELETE', key)), removed)
  equal((await context.fetch(path)).status, 404)
  equal((await context.fetch('/posts/transaction-fixture')).status, 404)
  const revisions = await context.db
    .prepare('SELECT COUNT(*) AS n FROM revisions WHERE document_id=?')
    .bind(documentId)
    .first<{ n: number }>()
  assert.ok(revisions !== null)
  equal(revisions.n, 2)
  const job = await context.db
    .prepare('SELECT state FROM schedules WHERE id=?')
    .bind(scheduled.scheduleId)
    .first<{ state: string }>()
  assert.ok(job !== null)
  equal(job.state, 'cancelled')
  await state(context)
}
