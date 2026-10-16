import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canSelectPreviousAtomicBlock, lastBlockDescendant } from '@/features/editor/core/block-deletion'
import { contentsHeadings } from '@/features/reader/contents-model'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

function text(value: string): { type: string, text: string }[] {
  return [
    { type: 'text', text: value },
  ]
}
function heading(id: string, level: number, title: string) {
  return {
    id,
    type: 'heading',
    props: { level },
    content: text(title),
    children: [],
  }
}

test('contents follows document order and nesting, flattens links, and omits footnote headings', () => {
  const first = heading('first', 1, ' Introduction ')
  const linked = { id: 'linked', type: 'heading', props: { level: 2 }, content: [
    ...text('A '),
    { type: 'link', content: text('linked title') },
  ], children: [] }
  const document = [
    first,
    { id: 'group', type: 'paragraph', props: {}, content: text('Text'), children: [
      linked,
      heading('nested', 3, 'Nested title'),
    ] },
    { id: 'note', type: 'footnote', props: {}, children: [
      heading('note-heading', 1, 'Omit this'),
    ] },
    heading('empty', 2, '   '),
  ]
  deepEqual(contentsHeadings(document), [
    { id: 'first', level: 1, text: 'Introduction' },
    { id: 'linked', level: 2, text: 'A linked title' },
    { id: 'nested', level: 3, text: 'Nested title' },
  ])
  deepEqual(contentsHeadings([
    { id: 'group', type: 'paragraph', props: {}, children: [
      linked,
      heading('nested', 3, 'Nested title'),
    ] },
    first,
  ]).map(item => item.id), [
    'linked',
    'nested',
    'first',
  ])
  linked.content = text('Renamed')
  assert.equal(contentsHeadings(document)[1]?.text, 'Renamed')
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('first Backspace selects only a preceding atomic block at a collapsed paragraph boundary', () => {
  const boundary = {
    currentType: 'paragraph',
    previousType: 'toc',
    collapsed: true,
    offset: 0,
    composing: false,
    busy: false,
  }
  for (const previousType of [
    'toc',
    'divider',
    'linkCard',
    'embed',
    'image',
    'audio',
    'video',
    'file',
    'math',
    'mermaid',
  ]) {
    assert.equal(canSelectPreviousAtomicBlock({ ...boundary, previousType }), true)
  }
  for (const previousType of [
    'paragraph',
    'heading',
    undefined,
  ]) {
    assert.equal(canSelectPreviousAtomicBlock({ ...boundary, previousType }), false)
  }
  for (const currentType of [
    'heading',
    'bulletListItem',
    'numberedListItem',
    'checkListItem',
    'math',
  ]) {
    assert.equal(canSelectPreviousAtomicBlock({ ...boundary, currentType }), false)
  }
  for (const guard of [
    { offset: 1 },
    { collapsed: false },
    { composing: true },
    { busy: true },
  ]) {
    assert.equal(canSelectPreviousAtomicBlock({ ...boundary, ...guard }), false)
  }
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})

test('deletion follows the deepest last child without changing the native block tree', () => {
  type Item = { id: string, children: Item[] }
  const math: Item = { id: 'math', children: [] }
  const parent: Item = { id: 'parent', children: [
    { id: 'first', children: [] },
    { id: 'last', children: [math] },
  ] }
  equal(lastBlockDescendant(parent), math)
  equal(lastBlockDescendant(math), math)
  equal(lastBlockDescendant<Item>(undefined), undefined)
  deepEqual(parent.children.map(item => item.id), ['first', 'last'])
}).catch((error: unknown) => {
  assert.fail(error instanceof Error ? error.message : 'Test failed')
})
