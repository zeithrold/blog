import type { EditorState, Transaction } from 'prosemirror-state'
import { getNodeById } from '@blocknote/core'
import { closeHistory } from 'prosemirror-history'
import { TextSelection } from 'prosemirror-state'
import { moveTableColumn, moveTableRow, TableMap } from 'prosemirror-tables'

export type TableAxis = 'row' | 'column'
export type TableMove = {
  id: string
  orientation: TableAxis
  from: number
  boundary: number
  headers: number
}

type NativeTable = { node: EditorState['doc'], start: number, map: TableMap }

export function tableNode(state: EditorState, id: string): NativeTable | null {
  const block = getNodeById(id, state.doc)
  const node = block?.node.firstChild
  if (block === undefined || node === null || node === undefined || node.type.spec.tableRole !== 'table') {
    return null
  }
  return { node, start: block.posBeforeNode + 2, map: TableMap.get(node) }
}

export function canDragTableAxis(state: EditorState, move: Omit<TableMove, 'boundary'>): boolean {
  const table = tableNode(state, move.id)
  if (table === null) {
    return false
  }
  const row = move.orientation === 'row'
  const count = row ? table.map.height : table.map.width
  if (!Number.isInteger(move.from) || move.from < move.headers || move.from >= count || count <= 1) {
    return false
  }
  return safeBoundary(table.map, row, move.from) && safeBoundary(table.map, row, move.from + 1)
}

export function canDropTableAxis(state: EditorState, move: TableMove): boolean {
  const table = tableNode(state, move.id)
  if (table === null || !canDragTableAxis(state, move)) {
    return false
  }
  const row = move.orientation === 'row'
  const count = row ? table.map.height : table.map.width
  const boundary = move.boundary
  if (!Number.isInteger(boundary) || boundary < move.headers || boundary > count) {
    return false
  }
  return safeBoundary(table.map, row, boundary)
}

function safeBoundary(map: TableMap, row: boolean, boundary: number): boolean {
  const count = row ? map.height : map.width
  if (boundary === 0 || boundary === count) {
    return true
  }
  const cross = row ? map.width : map.height
  const step = row ? map.width : 1
  // A repeated cell across the boundary is a spanning cell. Inspect only this edge,
  // rather than searching every cell rectangle on every pointer animation frame.
  for (let index = 0; index < cross; index++) {
    const position = row ? boundary * map.width + index : index * map.width + boundary
    if (map.map[position] === map.map[position - step]) {
      return false
    }
  }
  return true
}

export function tableMoveTransaction(state: EditorState, move: TableMove): Transaction | null {
  if (!canDropTableAxis(state, move) || move.boundary === move.from || move.boundary === move.from + 1) {
    return null
  }
  const table = tableNode(state, move.id)
  if (table === null) {
    return null
  }
  const position = table.start + table.map.positionAt(0, 0, table.node) + 1
  const prepared = state.apply(state.tr.setSelection(TextSelection.near(state.doc.resolve(position))))
  const command = move.orientation === 'row' ? moveTableRow : moveTableColumn
  const to = move.boundary > move.from ? move.boundary - 1 : move.boundary
  let result: Transaction | null = null
  command({ from: move.from, to, pos: position })(prepared, (transaction) => {
    const moved = getNodeById(move.id, transaction.doc)
    const node = moved?.node.firstChild
    if (moved !== undefined && node !== null && node !== undefined) {
      const map = TableMap.get(node)
      const row = move.orientation === 'row' ? to : 0
      const column = move.orientation === 'column' ? to : 0
      const cell = moved.posBeforeNode + 2 + map.positionAt(row, column, node) + 1
      transaction.setSelection(TextSelection.near(transaction.doc.resolve(cell)))
    }
    result = closeHistory(transaction)
  })
  return result
}
