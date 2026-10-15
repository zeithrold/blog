import type { TableAxis, TableMove } from '@/features/editor/core/table-move'
import type { TableEditor, TableTarget } from '@/features/editor/ui/table-controls-model'
import { closeHistory } from 'prosemirror-history'
import { canDragTableAxis, canDropTableAxis, tableMoveTransaction } from '@/features/editor/core/table-move'

type Editor = TableEditor
type Target = TableTarget

export function tableMoveRequest(editor: Editor, target: Target, orientation: TableAxis, from: number): TableMove {
  const block = editor.getBlock(target.id)
  const content = block?.type === 'table' ? block.content : undefined
  const headers = orientation === 'row' ? content?.headerRows : content?.headerCols
  return { id: target.id, orientation, from, boundary: from, headers: headers ?? 0 }
}

export function canStartTableMove(editor: TableEditor, target: TableTarget, move: TableMove): boolean {
  return editor.isEditable && target.table.isConnected && editor.domElement?.contains(target.table) === true
    && canDragTableAxis(editor.prosemirrorState, move)
}

export function canFinishTableMove(editor: TableEditor, target: TableTarget, move: TableMove): boolean {
  return canStartTableMove(editor, target, move) && canDropTableAxis(editor.prosemirrorState, move)
}

export function commitTableMove(editor: TableEditor, target: TableTarget, move: TableMove): boolean {
  if (!canFinishTableMove(editor, target, move)) {
    return false
  }
  const transaction = tableMoveTransaction(editor.prosemirrorState, move)
  if (transaction === null) {
    return false
  }
  editor.prosemirrorView.dispatch(transaction)
  // Keep typing or another move from joining this completed drag's history event.
  editor.prosemirrorView.dispatch(closeHistory(editor.prosemirrorState.tr))
  return true
}
