import type { TableAxis } from '@/features/editor/core/table-move'
import type { TableTarget } from '@/features/editor/ui/table-controls-model'

export type DragPoint = { x: number, y: number }
export type DragRect = { x: number, y: number, width: number, height: number }
export type DragGeometry = { boundary: number, source: DragRect, line: DragRect, inside: boolean }

function columnPoints(table: HTMLTableElement): number[] {
  const columns = Array.from(table.querySelectorAll('col'), col => col.getBoundingClientRect().width)
  if (columns.length > 0 && columns.every(width => width > 0)) {
    return cumulative(columns)
  }
  const sizes = Array.from(table.rows.item(0)?.cells ?? []).flatMap(cell =>
    Array.from<number>({ length: cell.colSpan }).fill(cell.getBoundingClientRect().width / cell.colSpan))
  return cumulative(sizes)
}

function cumulative(sizes: number[]): number[] {
  let point = 0
  return [
    0,
    ...sizes.map(size => (point += size)),
  ]
}

function nearestPoint(points: number[], position: number): number {
  let nearest = 0
  let distance = Infinity
  points.forEach((point, index) => {
    if (Math.abs(position - point) < distance) {
      nearest = index
      distance = Math.abs(position - point)
    }
  })
  return nearest
}

type Target = TableTarget
type Axis = TableAxis

export function tableDragGeometry(target: Target, orientation: Axis, from: number, point: DragPoint): DragGeometry {
  const table = target.table.getBoundingClientRect()
  const viewport = target.viewport.getBoundingClientRect()
  const left = viewport.left
  const right = left + Math.min(viewport.width, table.width)
  const row = orientation === 'row'
  const points = row
    ? cumulative(Array.from(target.table.rows, item => item.getBoundingClientRect().height))
    : columnPoints(target.table)
  const origin = row ? table.top : table.left
  const boundary = nearestPoint(points, (row ? point.y : point.x) - origin)
  const start = origin + pointAt(points, from)
  const end = origin + pointAt(points, from + 1)
  const destination = origin + pointAt(points, boundary)
  return {
    boundary,
    inside: point.x >= left - 64 && point.x <= right + 48
      && point.y >= table.top - 64 && point.y <= table.bottom + 48,
    source: sourceRect({ row, left, right, start, end, table }),
    line: row
      ? { x: left, y: destination - 1, width: right - left, height: 2 }
      : { x: Math.max(left, Math.min(right, destination)) - 1, y: table.top, width: 2, height: table.height },
  }
}

function sourceRect({ row, left, right, start, end, table }: {
  row: boolean
  left: number
  right: number
  start: number
  end: number
  table: DOMRect
}): DragRect {
  if (row) {
    return { x: left, y: start, width: right - left, height: end - start }
  }
  const x = Math.max(left, start)
  return { x, y: table.top, width: Math.max(0, Math.min(right, end) - x), height: table.height }
}

export function tableScrollParent(target: TableTarget): HTMLElement {
  let parent = target.wrapper.parentElement
  while (parent !== null) {
    const overflow = getComputedStyle(parent).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      return parent
    }
    parent = parent.parentElement
  }
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document.documentElement
}

function edgeSpeed(position: number, start: number, end: number): number {
  const band = 28
  if (position < start + band) {
    return -Math.min(1, (start + band - position) / band) * 520
  }
  return position > end - band ? Math.min(1, (position - end + band) / band) * 520 : 0
}

type ScrollStep = { parent: HTMLElement, elapsed: number }

export function scrollTableDrag(target: Target, orientation: TableAxis, point: DragPoint, step: ScrollStep): void {
  const { parent, elapsed } = step
  if (orientation === 'column') {
    const viewport = target.viewport.getBoundingClientRect()
    target.viewport.scrollLeft += edgeSpeed(point.x, viewport.left, viewport.right) * elapsed / 1000
    return
  }
  const viewport = parent === document.scrollingElement
    ? { top: 0, bottom: window.visualViewport?.height ?? window.innerHeight }
    : parent.getBoundingClientRect()
  const toolbar = target.wrapper.closest('.blog-editor')?.parentElement?.querySelector('.editor-actions')
  const top = Math.max(viewport.top, toolbar?.getBoundingClientRect().bottom ?? 0)
  parent.scrollTop += edgeSpeed(point.y, top, viewport.bottom) * elapsed / 1000
}

function pointAt(points: number[], index: number): number {
  return points[index] ?? 0
}
