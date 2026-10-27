import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyDocument } from '@/content/document'
import { safeStructuredJSON } from '@/content/structured-json'
import { pastedDocument } from '@/features/editor/engine/clipboard-document'
import { equal } from '~/tests/support/unit/assertions'

test('copied footnote groups receive new IDs and preserve their internal references', () => {
  const document = emptyDocument()
  const noteId = crypto.randomUUID()
  const paragraph = document.blocks[0]
  assert.ok(paragraph !== undefined)
  paragraph.content = [
    { type: 'footnoteRef', props: { noteId } },
  ]
  document.blocks.push({
    id: noteId,
    type: 'footnote',
    props: {},
    content: [
      { type: 'text', text: 'Copied note', styles: {} },
    ],
    children: [],
  })
  const result = pastedDocument(document, document.blocks, document.blocks)
  const copied = result.document.blocks[0]
  const note = result.document.blocks[1]
  assert.ok(copied !== undefined && note !== undefined && Array.isArray(copied.content))
  const reference = copied.content[0]
  assert.ok(reference?.type === 'footnoteRef')
  equal(reference.props.noteId, note.id)
  equal(note.id === noteId, false)
  equal(copied.id === paragraph.id, false)
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
test('JSON-LD serializes script delimiters and Unicode separators as data', () => {
  const value = { title: '</script><script>alert(1)</script>\u2028\u2029' }
  const result = safeStructuredJSON(value)
  equal(result.includes('<'), false)
  equal(result.includes('\u2028'), false)
  equal(JSON.stringify(JSON.parse(result)), JSON.stringify(value))
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('pasting after deleting annotated blocks validates the current body and preserves undo metadata', () => {
  const document = emptyDocument()
  const tableId = crypto.randomUUID()
  const mediaId = crypto.randomUUID()
  document.tableAccessibility[tableId] = { caption: 'Keep for undo' }
  document.mediaAccessibility[mediaId] = {
    alt: 'Keep for undo',
    decorative: false,
    transcript: '',
    captionAssetId: null,
    posterAssetId: null,
  }
  const before = structuredClone(document)
  const result = pastedDocument(document, document.blocks, emptyDocument().blocks)
  equal(result.document.blocks.length, 1)
  equal(Object.keys(result.document.tableAccessibility).length, 0)
  equal(Object.keys(result.document.mediaAccessibility).length, 0)
  equal(result.patch.tableAccessibility[tableId]?.caption, 'Keep for undo')
  equal(result.patch.mediaAccessibility[mediaId]?.alt, 'Keep for undo')
  equal(JSON.stringify(document), JSON.stringify(before))
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
