import type { Workspace } from '@/features/editor/workspace/editor-types'
import { TableHandlesExtension } from '@blocknote/core/extensions'
import { useEffect, useState } from 'react'

export type TableEditor = Workspace['model']['editor']
export type TableTarget = {
  id: string
  table: HTMLTableElement
  viewport: HTMLElement
  wrapper: HTMLElement
  widgets: HTMLElement
}
export type TableGeometry = {
  width: number
  height: number
  viewportWidth: number
  scrollLeft: number
  columns: number[]
  columnCount: number
  columnStarts: number[]
  rows: number[]
  rowIndexes: number[]
  rowCount: number
}

function tableTarget(table: HTMLTableElement): TableTarget | undefined {
  const wrapper = table.closest<HTMLElement>('.tableWrapper')
  const viewport = table.closest<HTMLElement>('.tableWrapper-inner')
  const widgets = wrapper?.querySelector<HTMLElement>('.table-widgets-container')
  const id = table.closest<HTMLElement>('[data-id]')?.dataset.id
  if (id === undefined || wrapper === null || viewport === null || widgets === null || widgets === undefined) {
    return undefined
  }
  return { id, table, viewport, wrapper, widgets }
}

function tableTargets(root: HTMLElement): TableTarget[] {
  const targets: TableTarget[] = []
  for (const table of root.querySelectorAll<HTMLTableElement>('[data-content-type=table] table')) {
    const target = tableTarget(table)
    if (target !== undefined) {
      targets.push(target)
    }
  }
  return targets
}

export function useTableTargets(editor: TableEditor): TableTarget[] {
  const [targets, setTargets] = useState<TableTarget[]>([])
  useEffect(() => {
    let frame = 0
    let observer: MutationObserver | undefined
    const collect = (): void => {
      const root = editor.domElement
      if (root === undefined) {
        frame = requestAnimationFrame(collect)
        return
      }
      const next = tableTargets(root)
      setTargets(previous => previous.length === next.length
        && previous.every((target, index) => target.table === next[index]?.table)
        ? previous
        : next)
      if (observer === undefined) {
        observer = new MutationObserver(() => {
          cancelAnimationFrame(frame)
          frame = requestAnimationFrame(collect)
        })
        observer.observe(root, { childList: true, subtree: true })
      }
    }
    frame = requestAnimationFrame(collect)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [editor])
  return targets
}

function measureTable(target: TableTarget): TableGeometry {
  const { table, viewport } = target
  const bounds = table.getBoundingClientRect()
  const cells = Array.from(table.rows.item(0)?.cells ?? [])
  const columnCount = table.querySelectorAll('col').length
  const starts = boundaries(cells.map(cell => Math.max(1, cell.colSpan)))
  return {
    width: bounds.width,
    height: bounds.height,
    viewportWidth: Math.min(viewport.clientWidth, bounds.width),
    scrollLeft: viewport.scrollLeft,
    columns: cells.map(cell => cell.getBoundingClientRect().width),
    columnCount: columnCount > 0 ? columnCount : starts.at(-1) ?? 0,
    columnStarts: starts.slice(0, -1),
    ...measureRowGroups(table),
  }
}

function measureRowGroups(table: HTMLTableElement): Pick<TableGeometry, 'rows' | 'rowIndexes' | 'rowCount'> {
  const heights = Array.from(table.rows, row => row.getBoundingClientRect().height)
  const rows: number[] = []
  const rowIndexes: number[] = []
  let index = 0
  while (index < heights.length) {
    rowIndexes.push(index)
    const remaining = heights.length - index
    const span = Math.min(remaining, Math.max(1, table.rows.item(index)?.cells.item(0)?.rowSpan ?? 1))
    rows.push(heights.slice(index, index + span).reduce((height, row) => height + row, 0))
    index += span
  }
  return { rows, rowIndexes, rowCount: heights.length }
}

export function useTableGeometry(target: TableTarget): TableGeometry {
  const [geometry, setGeometry] = useState(() => measureTable(target))
  useEffect(() => {
    let frame = 0
    const previousWidth = target.wrapper.style.getPropertyValue('--editor-table-width')
    const update = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        // Defer layout writes out of ResizeObserver delivery, especially in WebKit.
        // Retain TableView's column total as the wrapper's minimum width.
        const width = nativeTableWidth(target.table)
        if (target.wrapper.style.getPropertyValue('--editor-table-width') !== width) {
          target.wrapper.style.setProperty('--editor-table-width', width)
        }
        setGeometry(measureTable(target))
      })
    }
    const resize = new ResizeObserver(update)
    resize.observe(target.table)
    resize.observe(target.viewport)
    const mutation = new MutationObserver(update)
    mutation.observe(target.table, { attributes: true, childList: true, subtree: true })
    target.viewport.addEventListener('scroll', update, { passive: true })
    update()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      mutation.disconnect()
      target.viewport.removeEventListener('scroll', update)
      target.wrapper.style.setProperty('--editor-table-width', previousWidth)
    }
  }, [target])
  return geometry
}

function nativeTableWidth(table: HTMLTableElement): string {
  if (table.style.width !== '') {
    return table.style.width
  }
  if (table.style.minWidth !== '') {
    return table.style.minWidth
  }
  return '0px'
}

export function useTableActivity(target: TableTarget): boolean {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const enter = (): void => setActive(true)
    const leave = (): void => setActive(target.wrapper.contains(document.activeElement))
    const focusOut = (): void => {
      if (!target.wrapper.matches(':hover')) {
        setActive(false)
      }
    }
    target.wrapper.addEventListener('pointerenter', enter)
    target.wrapper.addEventListener('pointerleave', leave)
    target.wrapper.addEventListener('focusin', enter)
    target.wrapper.addEventListener('focusout', focusOut)
    return () => {
      target.wrapper.removeEventListener('pointerenter', enter)
      target.wrapper.removeEventListener('pointerleave', leave)
      target.wrapper.removeEventListener('focusin', enter)
      target.wrapper.removeEventListener('focusout', focusOut)
    }
  }, [target])
  return active
}

// The extension follows the hovered native table. Route keyboard/touch actions
// through the same native DOM entry point before invoking its public commands.
function canEditTable(editor: TableEditor, target: TableTarget): boolean {
  return editor.isEditable && editor.domElement?.contains(target.table) === true
    && editor.getBlock(target.id)?.type === 'table'
}

export function withNativeTable(editor: TableEditor, target: TableTarget, action: () => void): void {
  const handles = editor.getExtension(TableHandlesExtension)
  const cell = target.table.querySelector('td,th')
  if (handles === undefined || cell === null || !canEditTable(editor, target)) {
    return
  }
  handles.unfreezeHandles()
  try {
    const bounds = cell.getBoundingClientRect()
    cell.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: bounds.left + 1,
      clientY: bounds.top + 1,
    }))
    if (handles.store.state?.block.id !== target.id) {
      return
    }
    handles.freezeHandles()
    action()
  }
  finally {
    handles.unfreezeHandles()
    editor.focus()
  }
}

export function boundaries(sizes: readonly number[]): number[] {
  let position = 0
  return [
    0,
    ...sizes.map(size => (position += size)),
  ]
}
