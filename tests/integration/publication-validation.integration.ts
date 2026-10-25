import type { Document } from '@/content/document'
import type { Runtime } from '~/tests/support/worker/runtime'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'
import { publicationIssueList } from '@/content/publication-issues'
import { openDocumentSchema } from '@/contracts/documents'
import { deepEqual, equal } from '~/tests/support/unit/assertions'
import { json } from '~/tests/support/worker/responses'
import { runtime } from '~/tests/support/worker/runtime'

// The refusal a client renders: a problem document that carries the codes the
// settings panel maps to locate controls. The shape is part of the contract, so
// the case names every field it relies on.
const problem = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number(),
  code: z.string(),
  messageKey: z.string(),
  issues: z.unknown(),
  requestId: z.string(),
})

async function invalidEnvelope(context: Runtime) {
  const created = await json(await context.write('/api/admin/documents', {}), 201)
  const opened = await json(
    await context.fetch(`/api/admin/documents/${created.documentId}`),
    200,
    openDocumentSchema,
  )
  const document = opened.document
  document.meta.title = 'Publication validation'
  document.meta.slug = 'publication-validation'
  appendInvalidBlocks(document)
  // A draft keeps an unpublished envelope: only publication checks refuse it.
  const saved = await json(await context.write(`/api/admin/documents/${opened.documentId}/revisions`, {
    expectedVersion: opened.version,
    baseRevisionId: opened.headRevisionId,
    reason: 'manual',
    document,
  }, 'PUT'))
  return { id: opened.documentId, saved }
}

/** A table with no caption, a media block with no file, and an unrenderable source. */
function appendInvalidBlocks(document: Document): void {
  const fileId = crypto.randomUUID()
  document.blocks.push(
    {
      id: crypto.randomUUID(),
      type: 'table',
      props: { textColor: 'default' },
      content: {
        type: 'tableContent',
        columnWidths: [120, 120],
        rows: [
          { cells: [
            [
              { type: 'text', text: 'First cell', styles: {} },
            ],
            [],
          ] },
          { cells: [
            [],
            [],
          ] },
        ],
      },
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: 'callout',
      props: { tone: 'info' },
      content: [],
      children: [
        {
          id: fileId,
          type: 'file',
          props: { url: '', name: '', caption: '', backgroundColor: 'default' },
          children: [],
        },
      ],
    },
    {
      id: crypto.randomUUID(),
      type: 'mermaid',
      props: { description: '' },
      content: [
        { type: 'text', text: 'unsupported diagram', styles: {} },
      ],
      children: [],
    },
  )
  document.mediaAccessibility[fileId] = {
    alt: '',
    decorative: false,
    transcript: '',
    captionAssetId: null,
    posterAssetId: null,
  }
}

// The Worker owns the publication rule, so the refusal and its issue list are
// asserted against the built runtime rather than a declared reply.
test('built Worker: publishing an invalid envelope names every issue and leaves live untouched', async (t) => {
  const app = await runtime()
  t.after(async () => await app.dispose())
  const { id, saved } = await invalidEnvelope(app)
  const refusal = await app.write(`/api/admin/documents/${id}/publish`, {
    expectedVersion: saved.version,
    expectedLiveGeneration: saved.liveGeneration,
    revisionId: saved.headRevisionId,
  })
  equal(refusal.status, 422)
  equal(refusal.headers.get('content-type'), 'application/problem+json')
  const body = problem.parse(await refusal.json())
  equal(body.code, 'PUBLICATION_INVALID')
  equal(body.status, 422)
  equal(body.messageKey, 'errors.PUBLICATION_INVALID')
  equal(body.type, 'urn:ztd:cms:problem:publication-invalid')
  assert.ok(body.requestId.length > 0)
  // Uncaptioned table, the media block with no file, and the source the editor
  // cannot render — in document order, one code per kind of problem.
  deepEqual(publicationIssueList.parse(body.issues), [
    'table',
    'mediaSource',
    'diagram',
  ])
  const after = await json(await app.fetch(`/api/admin/documents/${id}`), 200, openDocumentSchema)
  equal(after.liveRevisionId, null)
  equal(after.liveGeneration, 0)
  equal(after.version, saved.version)
  equal((await app.fetch('/posts/publication-validation')).status, 404)
}).catch((error: unknown) => { throw error })
