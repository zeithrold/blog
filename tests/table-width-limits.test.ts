import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BlockNoteEditor, HistoryExtension } from '@blocknote/core'
import { EditorState } from 'prosemirror-state'
import { TABLE_COLUMN_MAX_WIDTH, TABLE_COLUMN_MIN_WIDTH } from '../src/content/table-limits'
import { tableWidthLimits } from '../src/features/editor/core/table-width-limits'

function nativeTableState() {
  const editor = BlockNoteEditor.create({
    extensions: [tableWidthLimits],
    initialContent: [
      {
        type: 'table',
        content: {
          type: 'tableContent',
          columnWidths: [
            120,
            180,
            undefined,
          ],
          headerRows: 1,
          rows: [
            { cells: [
              { type: 'tableCell', props: { colspan: 2 }, content: 'Spanning header' },
              { type: 'tableCell', content: 'Auto header' },
            ] },
            { cells: [
              { type: 'tableCell', content: 'First cell' },
              { type: 'tableCell', content: 'Neighbor cell' },
              { type: 'tableCell', content: 'Auto cell' },
            ] },
          ],
        },
      },
    ],
  })
  const limits = editor.getExtension('blogTableWidthLimits')
  const history = editor.getExtension(HistoryExtension)
  assert.ok(limits?.prosemirrorPlugins !== undefined)
  assert.ok(history !== undefined)
  const state = EditorState.create({
    schema: editor.pmSchema,
    doc: editor.prosemirrorState.doc,
    plugins: [
      ...history.prosemirrorPlugins,
      ...limits.prosemirrorPlugins,
    ],
  })
  return { state, history }
}

function resizeFirstColumn(state: EditorState, width: number) {
  const change = state.tr
  state.doc.descendants((node, position) => {
    if (!['tableHeader', 'tableCell'].includes(node.type.name)) {
      return
    }
    if (node.textContent === 'Spanning header' || node.textContent === 'First cell') {
      const widths: unknown = node.attrs.colwidth
      assert.ok(Array.isArray(widths))
      const remaining: unknown[] = widths.slice(1)
      change.setNodeMarkup(position, undefined, { ...node.attrs, colwidth: [
        width,
        ...remaining,
      ] }, node.marks)
    }
    return false
  })
  return change
}

for (const boundary of [
  { label: 'minimum', native: 35, bounded: TABLE_COLUMN_MIN_WIDTH },
  { label: 'maximum', native: 2105, bounded: TABLE_COLUMN_MAX_WIDTH },
]) {
  test(`native ${boundary.label} width correction keeps spanning cells and one history event`, () => {
    const fixture = nativeTableState()
    const before = fixture.state.doc
    const expected = fixture.state.applyTransaction(resizeFirstColumn(fixture.state, boundary.bounded))
    assert.equal(expected.transactions.length, 1)
    const result = fixture.state.applyTransaction(resizeFirstColumn(fixture.state, boundary.native))
    assert.equal(result.transactions.length, 2)
    assert.ok(result.state.doc.eq(expected.state.doc))
    let state = result.state
    assert.ok(fixture.history.undoCommand(state, (transaction) => {
      state = state.applyTransaction(transaction).state
    }))
    assert.ok(state.doc.eq(before))
    assert.ok(fixture.history.redoCommand(state, (transaction) => {
      state = state.applyTransaction(transaction).state
    }))
    assert.ok(state.doc.eq(expected.state.doc))
    assert.equal(state.applyTransaction(state.tr).transactions.length, 1)
  }).catch((error: unknown) => assert.fail(error instanceof Error ? error.message : 'Test failed'))
}
