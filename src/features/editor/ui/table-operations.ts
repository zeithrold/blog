import type { TableEditor, TableTarget } from '@/features/editor/ui/table-controls-model'
import { TableHandlesExtension } from '@blocknote/core/extensions'
import { withNativeTable } from '@/features/editor/ui/table-controls-model'

export type TableOperation = {
  editor: TableEditor
  target: TableTarget
  orientation: 'row' | 'column'
  index: number
  disabled: boolean
}

export function tableAxisSpan(target: TableTarget, orientation: 'row' | 'column', index: number): number {
  const cell = orientation === 'row'
    ? target.table.rows.item(index)?.cells.item(0)
    : target.table.rows.item(0)?.cells.item(index)
  if (cell === null || cell === undefined) {
    return 0
  }
  return orientation === 'row' ? cell.rowSpan : cell.colSpan
}

export function canRemoveTableSegment(
  target: TableTarget,
  orientation: 'row' | 'column',
  index: number,
  count: number,
): boolean {
  const span = tableAxisSpan(target, orientation, index)
  return span > 0 && span < count
}

export function addTableSegment(props: TableOperation, before: boolean): void {
  withNativeTable(props.editor, props.target, () => insertSegment(props, before))
}

function insertSegment(props: TableOperation, before: boolean): void {
  const { editor, target, orientation, index, disabled } = props
  const current = editor.getBlock(target.id)
  if (current?.type !== 'table' || disabled) {
    return
  }
  const count = orientation === 'row' ? current.content.rows.length : current.content.columnWidths.length
  const maximum = orientation === 'row' ? 100 : 20
  if (count < maximum) {
    nativeAdd(editor, orientation, index, before)
  }
}

function nativeAdd(editor: TableEditor, orientation: 'row' | 'column', index: number, before: boolean): void {
  const handles = editor.getExtension(TableHandlesExtension)
  if (orientation === 'row') {
    handles?.addRowOrColumn(index, { orientation, side: before ? 'above' : 'below' })
  }
  else {
    handles?.addRowOrColumn(index, { orientation, side: before ? 'left' : 'right' })
  }
}
