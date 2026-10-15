import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { canonicalize } from '../src/content/canonical'
import { validDiagram } from '../src/content/diagram-policy'
import { emptyDocument, validateDocument } from '../src/content/document'
import { matchingReferences } from '../src/features/editor/core/citation-search'
import { DocumentReader } from '../src/features/reader/document'
import { MathView } from '../src/features/reader/math'
import { mediaPolicy, validateCaptions } from '../src/server/media-policy'
import { timeChoices } from '../src/server/schedule-time'
import { deepEqual, equal } from './assertions'
import { renderWithLocale } from './render-fixture'

test('citation search finds reference keys, authors and titles without changing stored references', () => {
  const references = [
    {
      id: '117fd10a-59aa-4430-87b9-26db3c7c6ead',
      title: 'Distributed systems',
      authors: ['Grace Hopper'],
      year: 2026,
      url: '',
      doi: '',
    },
    {
      id: '82da8fa0-c775-4799-95a5-58e6ed04a62a',
      title: '中文系统设计',
      authors: ['林明'],
      year: null,
      url: '',
      doi: '',
    },
  ]
  const original = structuredClone(references)
  deepEqual(matchingReferences(references, '117fd10a').map(reference => reference.id), [
    references[0]?.id,
  ])
  deepEqual(matchingReferences(references, 'ＧＲＡＣＥ systems').map(reference => reference.id), [
    references[0]?.id,
  ])
  deepEqual(matchingReferences(references, '林明 设计').map(reference => reference.id), [
    references[1]?.id,
  ])
  deepEqual(matchingReferences(references, 'Grace missing'), [])
  deepEqual(matchingReferences(references, '   '), references)
  deepEqual(references, original)
  equal(matchingReferences(references, 'Hopper')[0], references[0])
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('rich citations, notes and math preserve native JSON and stable derived numbering', async () => {
  const doc = emptyDocument()
  const referenceId = crypto.randomUUID()
  const noteId = crypto.randomUUID()
  doc.meta.title = 'Rich document'
  doc.meta.slug = 'rich-document'
  doc.references = [
    {
      id: referenceId,
      title: '<img>Source',
      authors: ['Author'],
      year: 2026,
      url: 'https://example.com',
      doi: '',
    },
  ]
  const first = doc.blocks[0]
  assert.ok(first !== undefined)
  first.content = [
    { type: 'citation', props: { referenceId, locator: 'p. 3' } },
    { type: 'footnoteRef', props: { noteId } },
    { type: 'inlineMath', props: { source: 'x^2' } },
  ]
  doc.blocks.push({
    id: noteId,
    type: 'footnote',
    props: {},
    content: [
      { type: 'text', text: 'A note', styles: {} },
    ],
    children: [],
  })
  const canonical = await canonicalize(validateDocument(doc, true))
  equal((await canonicalize(JSON.parse(canonical.json))).hash, canonical.hash)
  const html = renderWithLocale(createElement(DocumentReader, { document: doc }))
  equal(html.includes('A note'), true)
  equal(html.includes(`href="#note-${noteId}"`), true)
  equal(html.includes('<math'), true)
  equal(html.includes('&lt;img&gt;Source'), true)
  equal(html.includes('<img>Source'), false)
  doc.references = []
  assert.doesNotThrow(() => validateDocument(doc))
  assert.throws(() => validateDocument(doc, true))
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
test('formula rendering never accepts HTML, external links or unbounded expansion', () => {
  for (const source of [
    '\\href{javascript:alert(1)}{x}',
    '\\htmlClass{bad}{x}',
    '\\def\\a{\\a}\\a',
  ]) {
    const html = renderWithLocale(createElement(MathView, { source }))
    equal(html.includes('href='), false)
    equal(html.includes('math-error'), true)
  }
  equal(validDiagram('graph TD\n A-->B'), true)
  for (const source of [
    '%%{init:{}}%%\ngraph TD',
    'graph TD\nclick A "https://evil.test"',
    'graph TD\nA[<img>]',
    'graph TD\nA[&lt;style&gt;]',
  ]) {
    equal(validDiagram(source), false)
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
test('DST gaps reject and overlaps require a chosen offset', () => {
  deepEqual(timeChoices('2026-03-08T02:30', 'America/New_York'), [])
  const overlap = timeChoices('2026-11-01T01:30', 'America/New_York')
  equal(overlap.length, 2)
  deepEqual(
    overlap.map(choice => choice.utcOffset),
    [-240, -300],
  )
  equal(timeChoices('2026-10-06T18:00', 'Asia/Shanghai')[0]?.utcOffset, 480)
  assert.throws(() => timeChoices('2026-02-30T12:00', 'UTC'))
  assert.throws(() => timeChoices('2026-10-06T12:00', 'Not/AZone'))
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
test('media budgets, extensions and captions follow the bounded role contract', () => {
  assert.throws(() =>
    mediaPolicy({ filename: 'a.png', role: 'image', type: 'image/png', bytes: 8388609 }),
  )
  assert.throws(() =>
    mediaPolicy({ filename: 'a.svg', role: 'image', type: 'image/svg+xml', bytes: 10 }),
  )
  assert.throws(() => validateCaptions('WEBVTT\n\n00:02.000 --> 00:01.000\nBackwards'))
  assert.throws(() => validateCaptions('WEBVTT\n\n00:00.000 --> 00:01.000\n<script>'))
  assert.doesNotThrow(() => validateCaptions('WEBVTT\n\n00:00.000 --> 00:01.000\nA caption'))
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
