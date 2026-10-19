import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BlockNoteEditor, HistoryExtension } from '@blocknote/core'
import { EditorState } from 'prosemirror-state'
import {
  canDragTableAxis,
  canDropTableAxis,
  tableMoveTransaction,
  tableNode,
} from '@/features/editor/blocks/table/table-move'

function fixture(merged: 'row' | 'column' | null = null) {
  const id = crypto.randomUUID()
  const rows = Array.from({ length: 3 }, (_, row) => ({
    cells: Array.from({ length: 3 }, (_cell, column) => ({
      type: 'tableCell' as const,
      props: {
        colspan: 1,
        rowspan: 1,
        backgroundColor: row === 0 ? 'blue' : 'default',
      },
      content: `${row}:${column}`,
    })),
  }))
  const first = rows[0]?.cells[0]
  assert.ok(first !== undefined)
  if (merged === 'row') {
    first.props.rowspan = 2
    rows[1]?.cells.shift()
  }
  if (merged === 'column') {
    first.props.colspan = 2
    rows[0]?.cells.splice(1, 1)
  }
  const editor = BlockNoteEditor.create({
    initialContent: [
      { id, type: 'table', content: {
        type: 'tableContent',
        columnWidths: [
          120,
          180,
          undefined,
        ],
        rows,
      } },
    ],
  })
  const history = editor.getExtension(HistoryExtension)
  assert.ok(history !== undefined)
  const state = EditorState.create({
    schema: editor.pmSchema,
    doc: editor.prosemirrorState.doc,
    plugins: history.prosemirrorPlugins,
  })
  return { id, state, history }
}

test('moving a column keeps native cell widths, formatting and one undo/redo', () => {
  const { id, state, history } = fixture()
  const before = tableNode(state, id)
  assert.ok(before !== null)
  const transaction = tableMoveTransaction(state, { id, orientation: 'column', from: 0, boundary: 3, headers: 0 })
  assert.ok(transaction !== null)
  let next = state.applyTransaction(transaction).state
  const movedDoc = next.doc
  const after = tableNode(next, id)
  assert.ok(after !== null)
  const first = after.node.firstChild
  const movedCell = first?.lastChild
  const originalCell = before.node.firstChild?.firstChild
  assert.ok(first !== null && movedCell !== null && movedCell !== undefined)
  assert.ok(originalCell !== null && originalCell !== undefined)
  assert.equal(first.textContent, '0:10:20:0')
  assert.equal(movedCell.eq(originalCell), true)
  assert.ok(history.undoCommand(next, (change) => {
    next = next.applyTransaction(change).state
  }))
  assert.ok(next.doc.eq(state.doc))
  assert.ok(history.redoCommand(next, (change) => {
    next = next.applyTransaction(change).state
  }))
  assert.ok(next.doc.eq(movedDoc))
}).catch((error: unknown) => { throw error })

test('moving rows preserves spans on the other axis and does not split merged destinations', () => {
  const { id, state } = fixture('column')
  const move = { id, orientation: 'row' as const, from: 0, boundary: 3, headers: 0 }
  assert.ok(canDragTableAxis(state, move))
  const transaction = tableMoveTransaction(state, move)
  assert.ok(transaction !== null)
  const table = tableNode(state.applyTransaction(transaction).state, id)
  assert.ok(table !== null)
  assert.equal(table.node.lastChild?.firstChild?.attrs.colspan, 2)
  assert.equal(table.node.lastChild.firstChild.textContent, '0:0')
}).catch((error: unknown) => { throw error })

for (const orientation of ['row', 'column'] as const) {
  test(`merged ${orientation} sources and interior boundaries cannot move`, () => {
    const { id, state } = fixture(orientation)
    for (const from of [0, 1]) {
      assert.equal(canDragTableAxis(state, { id, orientation, from, headers: 0 }), false)
    }
    const request = { id, orientation, from: 2, headers: 0, boundary: 1 }
    assert.equal(canDropTableAxis(state, request), false)
    assert.equal(tableMoveTransaction(state, request), null)
    const valid = tableMoveTransaction(state, { ...request, boundary: 0 })
    assert.ok(valid !== null)
    assert.equal(tableNode(state.applyTransaction(valid).state, id)?.map.problems, null)
  }).catch((error: unknown) => { throw error })
}

test('headers, unchanged positions and missing tables produce no document change', () => {
  const { id, state } = fixture()
  const move = { id, orientation: 'row' as const, from: 1, boundary: 0, headers: 1 }
  assert.equal(tableMoveTransaction(state, move), null)
  assert.equal(tableMoveTransaction(state, { ...move, from: 0, boundary: 3 }), null)
  assert.equal(tableMoveTransaction(state, { ...move, boundary: 1 }), null)
  assert.equal(tableMoveTransaction(state, { ...move, boundary: 2 }), null)
  assert.equal(tableMoveTransaction(state, { ...move, id: crypto.randomUUID(), boundary: 3 }), null)
}).catch((error: unknown) => { throw error })
