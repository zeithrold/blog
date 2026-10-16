import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nodeItem, sameNode } from '@/features/editor/core/native'
import { deepEqual, equal } from '~/tests/support/unit/assertions'

for (const structured of [false, true]) {
  test(`table citation guards and node updates (${structured ? 'structured' : 'array'} cells)`, () => {
    const citation = { type: 'citation', props: { referenceId: 'table-reference' } }
    const content = [
      citation,
      { type: 'link', content: [citation] },
    ]
    const block = {
      id: 'table',
      type: 'table',
      content: {
        type: 'tableContent',
        rows: [
          { cells: [
            structured ? { type: 'tableCell', content } : content,
          ] },
        ],
      },
    }
    deepEqual(nodeItem(block).references, ['table-reference', 'table-reference'])
    const removed = { ...block, content: { type: 'tableContent', rows: [
      { cells: [
        [],
      ] },
    ] } }
    equal(sameNode(block, removed), false)
    deepEqual(nodeItem(removed).references, [])
    equal(sameNode(block, structuredClone(block)), true)
  }).catch((error: unknown) => {
    assert.fail(error instanceof Error ? error.message : 'Test failed')
  })
}
