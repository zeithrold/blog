import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canonicalize } from '@/content/canonical'
import { ContentError, emptyDocument, validateDocument } from '@/content/document'
import { acknowledgementSchema } from '@/contracts/documents'
import { problemResponse } from '@/server/http/problem'
import { APIError, read } from '@/shared/admin/api-client'

function incompleteDocument(): ReturnType<typeof emptyDocument> {
  const document = emptyDocument()
  const tableId = crypto.randomUUID()
  const imageId = crypto.randomUUID()
  document.blocks.push({
    id: tableId,
    type: 'table',
    props: { textColor: 'default' },
    content: { type: 'tableContent', columnWidths: [120], rows: [
      { cells: [
        [],
      ] },
    ] },
    children: [],
  }, {
    id: imageId,
    type: 'image',
    props: {
      url: '',
      name: '',
      caption: '',
      backgroundColor: 'default',
      textAlignment: 'left',
      showPreview: true,
    },
    children: [],
  })
  document.mediaAccessibility[imageId] = {
    alt: '',
    decorative: false,
    transcript: '',
    captionAssetId: null,
    posterAssetId: null,
  }
  return document
}

test('publication returns all missing requirements through the HTTP and client error boundary', async () => {
  const document = incompleteDocument()
  assert.doesNotThrow(() => validateDocument(document))
  let failure: unknown
  try {
    validateDocument(document, true)
  }
  catch (error) {
    failure = error
  }
  assert.ok(failure instanceof ContentError)
  assert.equal(failure.code, 'PUBLICATION_INVALID')
  assert.deepEqual(failure.issues, [
    'title',
    'slug',
    'table',
    'mediaSource',
    'image',
  ])
  const response = problemResponse(failure)
  assert.equal(response.status, 422)
  await assert.rejects(read(response, acknowledgementSchema), new APIError(422, 'PUBLICATION_INVALID', failure.issues))
  document.meta.title = 'Fixed document'
  document.meta.slug = 'fixed-document'
  document.blocks = document.blocks.filter(block => block.type !== 'image')
  document.mediaAccessibility = {}
  const table = document.blocks.find(block => block.type === 'table')
  assert.notEqual(table, undefined)
  if (table === undefined) {
    throw new Error('Missing table fixture')
  }
  document.tableAccessibility[table.id] = { caption: 'Example table' }
  assert.doesNotThrow(() => validateDocument(document, true))
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('invalid or missing structured details preserve a usable error code', async () => {
  for (const issues of [
    undefined,
    ['unknown-requirement'],
  ]) {
    await assert.rejects(read(Response.json({ code: 'PUBLICATION_INVALID', issues }, {
      status: 422,
    }), acknowledgementSchema), new APIError(422, 'PUBLICATION_INVALID'))
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('drafts retain unresolved references while publication rejects them until repaired', async () => {
  const document = emptyDocument()
  document.meta.title = 'Incomplete references'
  document.meta.slug = 'incomplete-references'
  const paragraph = document.blocks[0]
  assert.ok(paragraph !== undefined)
  const noteId = crypto.randomUUID()
  const referenceId = crypto.randomUUID()
  paragraph.content = [
    { type: 'footnoteRef', props: { noteId } },
    { type: 'citation', props: { referenceId, locator: '' } },
  ]
  const saved = await canonicalize(document)
  assert.deepEqual(saved.document.blocks[0]?.content, paragraph.content)
  assert.throws(() => validateDocument(saved.document, true), (error: unknown) =>
    error instanceof ContentError && error.code === 'PUBLICATION_INVALID'
    && JSON.stringify(error.issues) === JSON.stringify(['citation', 'footnote']))
  document.blocks.push({ id: noteId, type: 'footnote', props: {}, content: [], children: [] })
  document.references.push({ id: referenceId, title: 'Restored source', authors: [
    'Author',
  ], year: null, url: '', doi: '' })
  assert.doesNotThrow(() => validateDocument(document, true))
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
