import type { TableEditor, TableTarget } from '@/features/editor/blocks/table/table-controls-model'
import { useEffect, useState } from 'react'

export function useTableCell(
  editor: TableEditor,
  compact: boolean,
  targets: TableTarget[],
): HTMLTableCellElement | null {
  const [cell, setCell] = useState<HTMLTableCellElement | null>(null)
  useEffect(() => {
    const root = editor.domElement
    if (!compact || root === undefined || targets.length === 0) {
      return
    }
    const select = (node: Node | null): void => {
      const element = node instanceof Element ? node : node?.parentElement
      const next = element?.closest('td,th')
      if (next instanceof HTMLTableCellElement && root.contains(next)) {
        setCell(next)
      }
    }
    const pointer = (event: PointerEvent): void => select(event.target instanceof Node ? event.target : null)
    const selection = (): void => select(document.getSelection()?.anchorNode ?? null)
    root.addEventListener('pointerdown', pointer, { passive: true })
    document.addEventListener('selectionchange', selection)
    selection()
    return () => {
      root.removeEventListener('pointerdown', pointer)
      document.removeEventListener('selectionchange', selection)
    }
  }, [
    editor,
    compact,
    targets,
  ])
  return cell !== null && cell.isConnected ? cell : null
}

export function activeTableGroup(target: TableTarget, cell: HTMLTableCellElement | null, row: boolean): number {
  if (cell === null || !target.table.contains(cell)) {
    return 0
  }
  if (row) {
    return cell.parentElement instanceof HTMLTableRowElement ? cell.parentElement.rowIndex : 0
  }
  const left = cell.getBoundingClientRect().left + 1
  return Array.from(target.table.rows.item(0)?.cells ?? [])
    .findIndex(first => first.getBoundingClientRect().right > left)
}
