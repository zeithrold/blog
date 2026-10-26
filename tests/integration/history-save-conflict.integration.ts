import type { Runtime } from '~/tests/support/worker/runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { openDocumentSchema } from '@/contracts/documents'
import { deepEqual, equal } from '~/tests/support/unit/assertions'
import { json, refusal } from '~/tests/support/worker/responses'
import { runtime } from '~/tests/support/worker/runtime'

type Opened = ReturnType<typeof openDocumentSchema.parse>

async function current(context: Runtime, id: string): Promise<Opened> {
  return await json(await context.fetch(`/api/admin/documents/${id}`), 200, openDocumentSchema)
}

async function save(
  context: Runtime,
  opened: Opened,
  title: string,
): Promise<Awaited<ReturnType<Runtime['write']>>> {
  const document = structuredClone(opened.document)
  document.meta.title = title
  return await context.write(`/api/admin/documents/${opened.documentId}/revisions`, {
    expectedVersion: opened.version,
    baseRevisionId: opened.headRevisionId,
    reason: 'manual',
    document,
  }, 'PUT')
}

async function revisionCount(context: Runtime, id: string): Promise<number> {
  const row = await context.db
    .prepare('SELECT COUNT(*) AS n FROM revisions WHERE document_id=?')
    .bind(id)
    .first<{ n: number }>()
  if (row === null) {
    throw new Error('The revision count query returned no row')
  }
  return row.n
}

// The editor conflict cases answer their refused save with a fixture, so the refusal
// code is theirs to choose. Only the Worker proves the server itself refuses the stale
// version and leaves the racing save exactly as the other tab wrote it; a second write
// would make the page's next save stale again without the notice ever saying so.
test('a save carrying a stale version is refused and leaves the racing save as head', async () => {
  const context = await runtime()
  try {
    const created = await json(await context.write('/api/admin/documents', {}), 201)
    const opened = await current(context, created.documentId)
    const racing = await json(await save(context, opened, 'Saved from another tab'))
    equal(racing.version, opened.version + 1)
    assert.notEqual(racing.headRevisionId, opened.headRevisionId)
    // The stale editor still holds `opened`; its autosave must not overwrite the race.
    const refused = await save(context, opened, 'Stale save from this tab')
    equal(await refusal(refused, 409), 'EDIT_CONFLICT')
    const after = await current(context, created.documentId)
    equal(after.headRevisionId, racing.headRevisionId)
    equal(after.version, racing.version)
    equal(after.document.meta.title, 'Saved from another tab')
    const row = await context.db
      .prepare('SELECT head_revision_id,version FROM documents WHERE id=?')
      .bind(created.documentId)
      .first<{ head_revision_id: string, version: number }>()
    deepEqual(row, { head_revision_id: racing.headRevisionId, version: racing.version })
    // The refusal wrote nothing: only the create and the racing save made revisions.
    equal(await revisionCount(context, created.documentId), 2)
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })
