import type { TableEditor, TableTarget } from '@/features/editor/blocks/table/table-controls-model'
import { TableHandlesExtension } from '@blocknote/core/extensions'
import { TableMap } from 'prosemirror-tables'
import { withNativeTable } from '@/features/editor/blocks/table/table-controls-model'
import { addTableSegment, canRemoveTableSegment } from '@/features/editor/blocks/table/table-operations'

function cellAxes(editor: TableEditor, cell: HTMLTableCellElement) {
  const position = editor.prosemirrorState.doc.resolve(editor.prosemirrorView.posAtDOM(cell, 0))
  let depth = position.depth
  while (depth > 0 && position.node(depth).type.spec.tableRole !== 'cell'
    && position.node(depth).type.spec.tableRole !== 'header_cell') {
    depth--
  }
  if (depth < 2) {
    return null
  }
  const table = position.node(depth - 2)
  const map = TableMap.get(table)
  const bounds = map.findCell(position.before(depth) - position.start(depth - 2))
  const firstRow = cell.closest('table')?.rows.item(0)
  let column = 0
  const index = Array.from(firstRow?.cells ?? []).findIndex((entry) => {
    column += entry.colSpan
    return bounds.left < column
  })
  return index < 0 ? null : { row: bounds.top, column: index, columns: map.width }
}

type TableAction = {
  readonly key: 'add_above_menuitem' | 'add_below_menuitem' | 'add_left_menuitem'
    | 'add_right_menuitem' | 'delete_row_menuitem' | 'delete_column_menuitem'
  readonly disabled: boolean
  readonly run: () => void
}

const choices = [
  { key: 'add_above_menuitem', orientation: 'row', before: true, remove: false },
  { key: 'add_below_menuitem', orientation: 'row', before: false, remove: false },
  { key: 'add_left_menuitem', orientation: 'column', before: true, remove: false },
  { key: 'add_right_menuitem', orientation: 'column', before: false, remove: false },
  { key: 'delete_row_menuitem', orientation: 'row', before: true, remove: true },
  { key: 'delete_column_menuitem', orientation: 'column', before: true, remove: true },
] as const

export function contextTableActions(
  editor: TableEditor,
  target: TableTarget,
  cell: HTMLTableCellElement,
  disabled: boolean,
): readonly TableAction[] {
  const axes = cellAxes(editor, cell)
  if (axes === null) {
    return []
  }
  const blocked = disabled || !editor.isEditable || !target.table.contains(cell)
  const rows = target.table.rows.length
  return choices.map((choice) => {
    const index = choice.orientation === 'row' ? axes.row : axes.column
    const count = choice.orientation === 'row' ? rows : axes.columns
    return ({
      key: choice.key,
      disabled: blocked || (choice.remove
        ? !canRemoveTableSegment(target, choice.orientation, index, count)
        : count >= (choice.orientation === 'row' ? 100 : 20)),
      run: () => {
        if (blocked) {
          return
        }
        if (choice.remove) {
          if (canRemoveTableSegment(target, choice.orientation, index, count)) {
            withNativeTable(editor, target, () =>
              editor.getExtension(TableHandlesExtension)?.removeRowOrColumn(index, choice.orientation))
          }
        }
        else {
          addTableSegment(
            { editor, target, orientation: choice.orientation, index, disabled: blocked },
            choice.before,
          )
        }
      },
    })
  })
}
