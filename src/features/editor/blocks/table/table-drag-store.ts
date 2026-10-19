import type { DragGeometry, DragPoint } from '@/features/editor/blocks/table/table-drag-geometry'
import type { TableAxis } from '@/features/editor/blocks/table/table-move'

export type TableDragPreview = DragGeometry & {
  orientation: TableAxis
  from: number
  valid: boolean
  point: DragPoint
}

export type TableDragStore = {
  getSnapshot: () => TableDragPreview | null
  subscribe: (listener: () => void) => () => void
  update: (next: TableDragPreview | null) => void
}

export function tableDragStore(): TableDragStore {
  let preview: TableDragPreview | null = null
  const listeners = new Set<() => void>()
  return {
    getSnapshot: (): TableDragPreview | null => preview,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    update: (next: TableDragPreview | null): void => {
      preview = next
      listeners.forEach((listener) => {
        listener()
      })
    },
  }
}
