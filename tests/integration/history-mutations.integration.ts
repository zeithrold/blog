import type { acknowledgementSchema } from '@/contracts/documents'
import type { Runtime } from '~/tests/support/worker/runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openDocumentSchema } from '@/contracts/documents'
import { deepEqual, equal } from '~/tests/support/unit/assertions'
import { json, refusal } from '~/tests/support/worker/responses'
import { runtime } from '~/tests/support/worker/runtime'

type Opened = ReturnType<typeof openDocumentSchema.parse>
type Ack = ReturnType<typeof acknowledgementSchema.parse>
type Stored = Pick<Opened, 'documentId' | 'version' | 'liveGeneration'>

async function current(context: Runtime, id: string): Promise<Opened> {
  return await json(await context.fetch(`/api/admin/documents/${id}`), 200, openDocumentSchema)
}

async function save(context: Runtime, opened: Opened, title: string, slug: string): Promise<Ack> {
  const document = structuredClone(opened.document)
  document.meta.title = title
  document.meta.slug = slug
  return await json(
    await context.write(
      `/api/admin/documents/${opened.documentId}/revisions`,
      {
        expectedVersion: opened.version,
        baseRevisionId: opened.headRevisionId,
        reason: 'manual',
        document,
      },
      'PUT',
    ),
  )
}

async function publish(context: Runtime, state: Stored, revisionId: string): Promise<Ack> {
  return await json(
    await context.write(`/api/admin/documents/${state.documentId}/publish`, {
      expectedVersion: state.version,
      expectedLiveGeneration: state.liveGeneration,
      revisionId,
    }),
  )
}

async function revisionCount(context: Runtime, id: string): Promise<number> {
  const row = await context.db
    .prepare('SELECT COUNT(*) AS n FROM revisions WHERE document_id=?')
    .bind(id)
    .first<{ n: number }>()
  assert.ok(row !== null)
  return row.n
}

async function events(context: Runtime, id: string, generation: number): Promise<number> {
  const row = await context.db
    .prepare('SELECT COUNT(*) AS n FROM publication_events WHERE document_id=? AND live_generation=?')
    .bind(id, generation)
    .first<{ n: number }>()
  assert.ok(row !== null)
  return row.n
}

// The history page holds the version and head it last read. A save from another tab
// advances both, so a restore carrying the stale version must be refused by the server
// itself. The component case supplies that refusal as a fixture; only the Worker can
// prove the persisted head, live revision and version stay exactly as the race left them.
test('a stale restore is refused and leaves the racing save as head', async () => {
  const context = await runtime()
  try {
    const created = await json(await context.write('/api/admin/documents', {}), 201)
    const opened = await current(context, created.documentId)
    const first = await save(context, opened, 'Published first', 'history-mutations-published')
    const live = await publish(context, first, first.headRevisionId)
    equal(live.liveRevisionId, first.headRevisionId)
    const stale = await current(context, created.documentId)
    const racing = await save(context, stale, 'Saved from another tab', 'history-mutations-published')
    assert.notEqual(racing.headRevisionId, stale.headRevisionId)
    equal(racing.version, stale.version + 1)
    const refused = await context.write(`/api/admin/documents/${created.documentId}/restore`, {
      expectedVersion: stale.version,
      revisionId: first.headRevisionId,
    })
    equal(await refusal(refused, 409), 'EDIT_CONFLICT')
    const after = await current(context, created.documentId)
    equal(after.headRevisionId, racing.headRevisionId)
    equal(after.liveRevisionId, first.headRevisionId)
    equal(after.version, racing.version)
    const row = await context.db
      .prepare('SELECT head_revision_id,live_revision_id,version FROM documents WHERE id=?')
      .bind(created.documentId)
      .first<{ head_revision_id: string, live_revision_id: string, version: number }>()
    deepEqual(row, {
      head_revision_id: racing.headRevisionId,
      live_revision_id: first.headRevisionId,
      version: racing.version,
    })
    // The refusal wrote nothing: only the create and the two saves made revisions.
    equal(await revisionCount(context, created.documentId), 3)
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })

// The component cases answer publish from their own fixture, so none of them can prove the
// persisted version. Only the Worker shows that publishing a selected historical revision
// advances the stored version by exactly one: a second increment would leave the page's
// next expected version stale even though the live revision looked right.
test('publishing a selected historical revision advances the persisted version exactly once', async () => {
  const context = await runtime()
  try {
    const created = await json(await context.write('/api/admin/documents', {}), 201)
    const opened = await current(context, created.documentId)
    const first = await save(context, opened, 'Published first', 'history-mutations-published')
    const live = await publish(context, first, first.headRevisionId)
    equal(live.liveRevisionId, first.headRevisionId)
    const latest = await save(
      context,
      await current(context, created.documentId),
      'Latest draft',
      'history-mutations-draft',
    )
    const restored = await json(
      await context.write(`/api/admin/documents/${created.documentId}/restore`, {
        expectedVersion: latest.version,
        revisionId: first.headRevisionId,
      }),
      201,
    )
    // The selected revision is the draft the restore replaced, not the new head.
    const selected = latest.headRevisionId
    const before = await current(context, created.documentId)
    equal(before.headRevisionId, restored.headRevisionId)
    equal(before.liveRevisionId, first.headRevisionId)
    assert.notEqual(selected, before.headRevisionId)
    const published = await publish(context, before, selected)
    equal(published.unchanged, undefined)
    equal(published.version, before.version + 1)
    equal(published.headRevisionId, before.headRevisionId)
    equal(published.liveRevisionId, selected)
    const after = await current(context, created.documentId)
    equal(after.version, before.version + 1)
    equal(after.liveRevisionId, selected)
    const row = await context.db
      .prepare('SELECT version,live_revision_id FROM documents WHERE id=?')
      .bind(created.documentId)
      .first<{ version: number, live_revision_id: string }>()
    deepEqual(row, { version: before.version + 1, live_revision_id: selected })
    // The readers get the selected revision's snapshot, and the publication was recorded once.
    equal((await context.fetch('/posts/history-mutations-draft')).status, 200)
    equal((await context.fetch('/posts/history-mutations-published')).status, 404)
    equal(await events(context, created.documentId, published.liveGeneration), 1)
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })

// The history page reconciles a lost answer by refreshing before it tries again, so the
// stored document sees nine separate restores rather than nine attempts at one write.
// Only real D1 can show each of them committed exactly one revision and one version step,
// and that replaying the last request under its own key adds nothing.
test('nine sequential restores commit one revision each and replay idempotently', async () => {
  const context = await runtime()
  try {
    const created = await json(await context.write('/api/admin/documents', {}), 201)
    const path = `/api/admin/documents/${created.documentId}`
    const opened = await current(context, created.documentId)
    const first = await save(context, opened, 'Published first', 'history-mutations-published')
    const live = await publish(context, first, first.headRevisionId)
    equal(live.liveRevisionId, first.headRevisionId)
    const latest = await save(
      context,
      await current(context, created.documentId),
      'Latest draft',
      'history-mutations-draft',
    )
    equal(latest.version, live.version + 1)
    let request = { expectedVersion: 0, revisionId: first.headRevisionId }
    let key = ''
    let last: Ack | null = null
    for (let attempt = 1; attempt <= 9; attempt++) {
      const before = await current(context, created.documentId)
      request = { expectedVersion: before.version, revisionId: first.headRevisionId }
      key = crypto.randomUUID()
      const restored = await json(await context.write(`${path}/restore`, request, 'POST', key), 201)
      equal(restored.version, before.version + 1)
      assert.notEqual(restored.headRevisionId, before.headRevisionId)
      equal(restored.liveRevisionId, first.headRevisionId)
      equal(await revisionCount(context, created.documentId), 3 + attempt)
      const after = await current(context, created.documentId)
      equal(after.version, restored.version)
      equal(after.headRevisionId, restored.headRevisionId)
      // The head keeps the selected revision's document, not the draft it replaced.
      equal(after.document.meta.title, 'Published first')
      last = restored
    }
    assert.ok(last !== null)
    // The same key and body is the same write: identical answer, no tenth revision.
    deepEqual(await json(await context.write(`${path}/restore`, request, 'POST', key), 201), last)
    equal(await revisionCount(context, created.documentId), 12)
    equal((await current(context, created.documentId)).version, last.version)
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })
