import type { PointerEvent } from 'react'
import type { TableEditor, TableTarget } from '@/features/editor/blocks/table/table-controls-model'
import type { TableDragStore } from '@/features/editor/blocks/table/table-drag-store'
import type { TableMove } from '@/features/editor/blocks/table/table-move'
import { useEffect, useRef, useState } from 'react'
import {
  scrollTableDrag,
  tableDragGeometry,
  tableScrollParent,
} from '@/features/editor/blocks/table/table-drag-geometry'
import { startTableDragSession } from '@/features/editor/blocks/table/table-drag-session'
import { tableDragStore } from '@/features/editor/blocks/table/table-drag-store'
import { tableNode } from '@/features/editor/blocks/table/table-move'
import {
  canFinishTableMove,
  canStartTableMove,
  commitTableMove,
} from '@/features/editor/blocks/table/table-move-operation'

export type TableDragControls = {
  begin: (event: PointerEvent<HTMLButtonElement>, request: TableMove, tap: () => void) => void
  move: (request: TableMove) => boolean
  active: boolean
  selected: TableMove | null
  store: TableDragStore
}

type DragOptions = { disabled: boolean, overlay: HTMLElement | null }

export function useTableDrag(editor: TableEditor, target: TableTarget, environment: DragOptions): TableDragControls {
  const { disabled, overlay } = environment
  const [store] = useState(tableDragStore)
  const [active, setActive] = useState(false)
  const [selected, setSelected] = useState<TableMove | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const move = (request: TableMove): boolean => {
    if (disabled || !commitTableMove(editor, target, request)) {
      return false
    }
    const index = request.boundary > request.from ? request.boundary - 1 : request.boundary
    setSelected({ ...request, from: index })
    requestAnimationFrame(() => {
      target.widgets.querySelector<HTMLButtonElement>(
        `[data-table-control-${request.orientation}="${index}"]`,
      )?.focus({ preventScroll: true })
    })
    return true
  }
  const begin = (event: PointerEvent<HTMLButtonElement>, request: TableMove, tap: () => void): void => {
    if (event.button !== 0 || !event.isPrimary || disabled) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    cancelRef.current?.()
    cancelRef.current = beginTableMove(event, request, tap, {
      editor,
      target,
      overlay,
      store,
      setActive,
      move,
      cancel: () => cancelRef.current?.(),
    })
  }

  useEffect(() => () => {
    cancelRef.current?.()
  }, [
    disabled,
    target,
    overlay,
  ])
  useEffect(() => {
    const clear = (): void => setSelected(null)
    const root = editor.domElement
    root?.addEventListener('pointerdown', clear)
    root?.addEventListener('keydown', clear)
    return () => {
      root?.removeEventListener('pointerdown', clear)
      root?.removeEventListener('keydown', clear)
    }
  }, [editor])
  return { begin, move, active, selected, store }
}

type MoveContext = {
  editor: TableEditor
  target: TableTarget
  overlay: HTMLElement | null
  store: TableDragStore
  setActive: (active: boolean) => void
  move: (request: TableMove) => boolean
  cancel: () => void
}

type HandleEvent = PointerEvent<HTMLButtonElement>

function beginTableMove(event: HandleEvent, request: TableMove, tap: () => void, context: MoveContext): () => void {
  const { editor, target, store, setActive, move } = context
  const node = tableNode(editor.prosemirrorState, target.id)?.node
  const button = event.currentTarget
  const parent = tableScrollParent(target)
  const root = target.wrapper.closest<HTMLElement>('.blog-editor')
  const unchanged = (): boolean => node?.eq(tableNode(editor.prosemirrorState, target.id)?.node ?? node) === true
    && canStartTableMove(editor, target, request)
  return startTableDragSession({
    event: event.nativeEvent,
    button,
    allowed: canStartTableMove(editor, target, request),
    tap,
    start: () => {
      setActive(true)
      setDragging(root, context.overlay, true)
      button.focus({ preventScroll: true })
    },
    frame: (point, elapsed) => {
      if (!unchanged()) {
        context.cancel()
        return
      }
      scrollTableDrag(target, request.orientation, point, { parent, elapsed })
      const geometry = tableDragGeometry(target, request.orientation, request.from, point)
      const valid = geometry.inside && canFinishTableMove(editor, target, { ...request, boundary: geometry.boundary })
      store.update({ ...geometry, ...request, boundary: geometry.boundary, point, valid })
    },
    finish: (point) => {
      if (point !== null && unchanged()) {
        const geometry = tableDragGeometry(target, request.orientation, request.from, point)
        if (geometry.inside) {
          move({ ...request, boundary: geometry.boundary })
        }
      }
      store.update(null)
      setDragging(root, context.overlay, false)
      setActive(false)
    },
  })
}

function setDragging(root: HTMLElement | null, overlay: HTMLElement | null, active: boolean): void {
  for (const element of [root, overlay]) {
    if (element === null) {
      continue
    }
    if (active) {
      element.dataset.tableDragging = 'true'
    }
    else { delete element.dataset.tableDragging }
  }
}
