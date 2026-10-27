import type { Block, Document } from '@/content/document'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyDocument } from '@/content/document'
import { compareRevisions } from '@/features/history/revision-diff'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

function paragraph(value: string): Block {
  return {
    id: crypto.randomUUID(),
    type: 'paragraph',
    props: { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' },
    content: [
      { type: 'text', text: value, styles: {} },
    ],
    children: [],
  }
}
test('stable ID differences ignore sibling insertion shifts and isolate nested child changes', () => {
  const before = emptyDocument()
  const a = paragraph('First')
  const b = paragraph('Second')
  before.blocks = [a, b]
  const after = structuredClone(before)
  const added = paragraph('Inserted')
  const child = paragraph('Nested')
  after.blocks.unshift(added)
  after.blocks[1]?.children.push(child)
  const difference = compareRevisions(before, after)
  deepEqual(difference.blocks.map(block => [block.id, block.kind]), [
    [added.id, 'added'],
    [child.id, 'added'],
  ])
  equal(difference.blocks.some(block => block.moved), false)
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
test('reordering keeps stable IDs distinct from content changes and detects parent moves', () => {
  const before = emptyDocument()
  const a = paragraph('First')
  const b = paragraph('Second')
  before.blocks = [a, b]
  const after = structuredClone(before)
  after.blocks.reverse()
  deepEqual(compareRevisions(before, after).blocks.map(block => block.kind), ['moved', 'moved'])
  after.blocks = [
    structuredClone(a),
  ]
  after.blocks[0]?.children.push(structuredClone(b))
  deepEqual(compareRevisions(before, after).blocks.map(block => [block.id, block.kind]), [
    [b.id, 'moved'],
  ])
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
function withMetadata(): Document {
  const document = emptyDocument()
  const image = crypto.randomUUID()
  document.blocks.push({
    id: image,
    type: 'image',
    props: { url: `/assets/${crypto.randomUUID()}` },
    children: [],
  })
  document.mediaAccessibility[image] = {
    alt: 'Original alternative text',
    decorative: false,
    transcript: '',
    captionAssetId: null,
    posterAssetId: null,
  }
  document.references.push({
    id: crypto.randomUUID(),
    title: 'Original reference',
    authors: ['Author'],
    year: 2025,
    doi: '',
    url: '',
  })
  const table = crypto.randomUUID()
  document.blocks.push({
    id: table,
    type: 'table',
    props: { textColor: 'default' },
    content: { type: 'tableContent', columnWidths: [120], rows: [
      { cells: [
        [],
      ] },
    ] },
    children: [],
  })
  document.tableAccessibility[table] = { caption: 'Original table caption' }
  return document
}
test('metadata, references, media and styled text differences remain separate and immutable', () => {
  const before = withMetadata()
  before.blocks[0] = paragraph('Same text')
  const after = structuredClone(before)
  after.meta.title = 'Changed title'
  const reference = after.references[0]
  assert.ok(reference !== undefined)
  reference.year = 2026
  const image = Object.keys(after.mediaAccessibility)[0]
  assert.ok(image !== undefined)
  const accessibility = after.mediaAccessibility[image]
  assert.ok(accessibility !== undefined)
  accessibility.alt = 'Updated alternative text'
  const table = Object.keys(after.tableAccessibility)[0]
  assert.ok(table !== undefined)
  after.tableAccessibility[table] = { caption: 'Changed table caption' }
  const first = after.blocks[0]
  assert.ok(first !== undefined)
  first.content = [
    { type: 'text', text: 'Same text', styles: { bold: true } },
  ]
  const original = JSON.stringify(before)
  const difference = compareRevisions(before, after)
  deepEqual(difference.metadata.map(field => field.key), ['title'])
  equal(difference.references[0]?.key, reference.id)
  equal(difference.media[0]?.key, image)
  equal(difference.tables[0]?.key, table)
  equal(difference.blocks[0]?.kind, 'changed')
  equal(difference.blocks[0]?.before, difference.blocks[0]?.after)
  equal(JSON.stringify(before), original)
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
test('identical text with a new ID represents a deleted and added block', () => {
  const before = emptyDocument()
  const after = structuredClone(before)
  const block = after.blocks[0]
  assert.ok(block !== undefined)
  block.id = crypto.randomUUID()
  deepEqual(compareRevisions(before, after).blocks.map(item => item.kind), ['added', 'removed'])
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
