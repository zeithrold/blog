import assert from 'node:assert/strict'
import { test } from 'node:test'
import { emptyDocument } from '../src/content/document'
import { publicationProblems, publicationRequirements } from '../src/content/publication-validation'
import { nodeItem, nodes, sameNode } from '../src/features/editor/core/native'
import { publicationIssues, publicationPath } from '../src/features/editor/core/publication-model'
import { deepEqual, equal } from './assertions'

test('empty citation and footnote selection changes invalidate the publication index', () => {
  const before = { id: 'paragraph', type: 'paragraph', content: [] }
  for (const inline of [
    { type: 'citation', props: { referenceId: '' } },
    { type: 'footnoteRef', props: { noteId: '' } },
  ]) {
    const after = { ...before, content: [inline] }
    equal(sameNode(before, after), false)
    equal(sameNode(after, before), false)
    equal(sameNode(after, { ...after }), true)
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('publication groups identify every affected block once and remove corrected targets', () => {
  const document = emptyDocument()
  document.meta.title = 'Multiple problems'
  document.meta.slug = 'multiple-problems'
  const first = nodeItem({ id: 'first', type: 'table', content: { type: 'tableContent', rows: [
    { cells: [
      [
        { type: 'citation', props: { referenceId: 'missing' } },
        { type: 'citation', props: { referenceId: 'another' } },
      ],
    ] },
  ] } })
  const second = nodeItem({ id: 'second', type: 'table' })
  const items = [first, second]
  deepEqual(publicationProblems(document, items), [
    { issue: 'table', blockIds: ['first', 'second'] },
    { issue: 'citation', blockIds: ['first'] },
  ])
  document.tableAccessibility.first = { caption: 'First corrected' }
  deepEqual(publicationProblems(document, items), [
    { issue: 'citation', blockIds: ['first'] },
    { issue: 'table', blockIds: ['second'] },
  ])
  deepEqual(publicationProblems(document, [second]), [
    { issue: 'table', blockIds: ['second'] },
  ])
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('publication summary requires a title and a valid unreserved public path', () => {
  const document = emptyDocument()
  deepEqual(publicationIssues(document, []), ['title', 'slug'])
  document.meta.title = 'Publication example'
  document.meta.slug = 'example'
  deepEqual(publicationIssues(document, []), [])
  equal(publicationPath('article', document.meta.slug), '/posts/example')
  equal(publicationPath('page', document.meta.slug), '/pages/example')
  document.meta.slug = 'admin'
  deepEqual(publicationIssues(document, []), ['slug'])
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('publication summary identifies media, table and unresolved citation requirements', () => {
  const document = emptyDocument()
  document.meta.title = 'Accessibility example'
  document.meta.slug = 'accessibility-example'
  const items = [
    { id: 'image', type: 'image', content: [] },
    { id: 'audio', type: 'audio', content: [] },
    { id: 'table', type: 'table', content: [] },
    { id: 'paragraph', type: 'paragraph', content: [
      { type: 'citation', props: { referenceId: 'missing' } },
    ] },
  ].map(nodeItem)
  deepEqual(publicationIssues(document, items), [
    'media',
    'table',
    'citation',
  ])
  document.mediaAccessibility.image = {
    alt: '',
    decorative: false,
    transcript: '',
    captionAssetId: null,
    posterAssetId: null,
  }
  document.mediaAccessibility.audio = { ...document.mediaAccessibility.image }
  deepEqual(publicationIssues(document, items), [
    'image',
    'transcript',
    'table',
    'citation',
  ])
  document.mediaAccessibility.image.decorative = true
  document.mediaAccessibility.audio.transcript = 'Audio transcript'
  document.tableAccessibility.table = { caption: 'A table caption' }
  document.references = [
    { id: 'missing', title: 'Reference', authors: ['Author'], year: null, url: '', doi: '' },
  ]
  deepEqual(publicationIssues(document, items), [])
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('preflight tracks missing media, diagram edits and deleted footnotes using the server rules', () => {
  const document = emptyDocument()
  document.meta.title = 'Readiness'
  document.meta.slug = 'readiness'
  const paragraph = document.blocks[0]
  assert.ok(paragraph !== undefined)
  const noteId = crypto.randomUUID()
  paragraph.content = [
    { type: 'footnoteRef', props: { noteId } },
  ]
  document.blocks.push({
    id: crypto.randomUUID(),
    type: 'mermaid',
    props: { description: '' },
    content: [],
    children: [],
  }, {
    id: crypto.randomUUID(),
    type: 'file',
    props: { url: '', name: '', caption: '', backgroundColor: 'default' },
    children: [],
  })
  deepEqual(publicationIssues(document, nodes(document)), [
    'footnote',
    'diagram',
    'mediaSource',
    'media',
  ])
  deepEqual(publicationRequirements(document), publicationIssues(document, nodes(document)))
  const diagram = document.blocks[1]
  assert.ok(diagram !== undefined)
  const corrected = { ...diagram, content: [
    { type: 'text' as const, text: 'graph TD\nA-->B', styles: {} },
  ] }
  equal(sameNode(diagram, corrected), false)
  document.blocks[1] = corrected
  document.blocks.push({ id: noteId, type: 'footnote', props: {}, content: [], children: [] })
  deepEqual(publicationIssues(document, nodes(document)), ['mediaSource', 'media'])
  const file = document.blocks[2]
  assert.ok(file !== undefined)
  equal(sameNode(file, { ...file, props: { ...file.props, url: '/assets/example' } }), false)
  equal(sameNode(paragraph, { ...paragraph, content: [] }), false)
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
