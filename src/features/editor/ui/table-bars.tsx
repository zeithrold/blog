import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react'
import type { TableEditor, TableGeometry, TableTarget } from '@/features/editor/ui/table-controls-model'
import type { TableDragControls } from '@/features/editor/ui/table-drag-controls'
import type { TableKeyboardControls } from '@/features/editor/ui/table-keyboard-controls'
import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { useTableBarScroll } from '@/features/editor/ui/table-bar-scroll'
import { activeTableGroup } from '@/features/editor/ui/table-cell-controls'
import { boundaries } from '@/features/editor/ui/table-controls-model'
import { tableBarClass, tableInsertClass } from '@/features/editor/ui/table-controls-utilities'
import { addTableSegment } from '@/features/editor/ui/table-operations'
import { TableSegmentMenu } from '@/features/editor/ui/table-segment-menu'
import { useBlogTranslation } from '@/i18n/use-translation'

type BarProps = {
  editor: TableEditor
  target: TableTarget
  geometry: TableGeometry
  orientation: 'row' | 'column'
  compact: boolean
  cell: HTMLTableCellElement | null
  active: boolean
  disabled: boolean
  portalElement: HTMLElement | null
  keyboard: TableKeyboardControls
  drag: TableDragControls
  onOpenChange: (open: boolean) => void
}

export function TableBar(props: BarProps): ReactNode {
  const { target, geometry, orientation, compact, active } = props
  const barRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const row = orientation === 'row'
  const sizes = row ? geometry.rows : geometry.columns
  const points = boundaries(sizes)
  const syncBarScroll = useTableBarScroll(target, row || compact, barRef)
  const showNearest = (event: PointerEvent<HTMLDivElement>): void => {
    const columnThreshold = compact ? 26 : 16
    const threshold = row ? 10 : columnThreshold
    setHovered(nearestBoundary(event, points, { row, scrollLeft: target.viewport.scrollLeft, threshold }))
  }
  return (
    <div
      ref={barRef}
      className={cn(
        compact ? 'absolute flex pointer-events-none text-muted-foreground' : tableBarClass,
        row ? 'editor-table-row-bar flex-col' : 'editor-table-column-bar overflow-hidden',
        active ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      style={barBounds(props)}
      onPointerMove={showNearest}
      onPointerDown={showNearest}
      onPointerLeave={() => setHovered(null)}
      onScroll={compact ? undefined : syncBarScroll}
    >
      {compact
        ? <CompactTableHandles {...props} sizes={sizes} points={points} />
        : <TableBarContents {...props} sizes={sizes} points={points} hovered={hovered} onReveal={setHovered} />}
    </div>
  )
}

function barBounds({ geometry, orientation, compact }: BarProps): CSSProperties {
  if (compact) {
    // The column target stays above cell text; its lower 10px shows the grip across the border.
    return orientation === 'row'
      ? { top: -geometry.height, left: -22, width: 44, height: geometry.height }
      : { top: -geometry.height - 44, left: 0, width: geometry.viewportWidth, height: 54 }
  }
  const thickness = 26
  return orientation === 'row'
    ? {
        top: -geometry.height,
        left: -thickness - 6,
        width: thickness,
        height: geometry.height,
      }
    : { top: -geometry.height - thickness - 6, left: 0, width: geometry.viewportWidth, height: thickness }
}

function CompactTableHandles(props: BarProps & { sizes: number[], points: number[] }): ReactNode {
  const { geometry, orientation, sizes, points, target, cell } = props
  const row = orientation === 'row'
  const moved = props.drag.selected?.orientation === orientation ? props.drag.selected : null
  const selected = moved?.from ?? activeTableGroup(target, cell, row)
  const indexes = row ? geometry.rowIndexes : geometry.columnStarts
  const group = row || moved !== null ? indexes.findLastIndex(index => index <= selected) : selected
  return sizes.map((size, index) => {
    const center = (points[index] ?? 0) + size / 2
    const left = Math.max(0, Math.min(geometry.viewportWidth - 44, center - geometry.scrollLeft - 22))
    return (
      <TableSegmentMenu
        key={`${target.id}-${orientation}-${points[index] ?? 0}`}
        {...props}
        index={row ? geometry.rowIndexes[index] ?? index : index}
        position={row ? geometry.rowIndexes[index] ?? index : geometry.columnStarts[index] ?? index}
        count={row ? geometry.rowCount : geometry.columnCount}
        size={size}
        last={index === sizes.length - 1}
        compactHandle={{ selected: index === group, style: row ? { top: center - 22, left: 0 } : { left, top: 0 } }}
      />
    )
  })
}

function nearestBoundary(
  event: PointerEvent<HTMLDivElement>,
  points: readonly number[],
  { row, scrollLeft, threshold }: { row: boolean, scrollLeft: number, threshold: number },
): number | null {
  const bounds = event.currentTarget.getBoundingClientRect()
  const position = row ? event.clientY - bounds.top : event.clientX - bounds.left + scrollLeft
  let nearest = 0
  let distance = Infinity
  points.forEach((point, index) => {
    if (Math.abs(point - position) < distance) {
      distance = Math.abs(point - position)
      nearest = index
    }
  })
  return distance <= threshold ? nearest : null
}

type ContentsProps = BarProps & {
  sizes: number[]
  points: number[]
  hovered: number | null
  onReveal: (boundary: number) => void
}

function TableBarContents(props: ContentsProps): ReactNode {
  const { geometry, orientation, sizes, points, target } = props
  const row = orientation === 'row'
  return (
    <div
      className={cn('relative flex shrink-0', row ? 'w-full flex-col' : 'h-full')}
      style={row ? { height: geometry.height } : { width: geometry.width }}
    >
      {sizes.map((size, index) => (
        <TableSegmentMenu
          key={`${target.id}-${orientation}-${points[index] ?? 0}`}
          {...props}
          index={row ? geometry.rowIndexes[index] ?? index : index}
          position={row ? geometry.rowIndexes[index] ?? index : geometry.columnStarts[index] ?? index}
          count={row ? geometry.rowCount : geometry.columnCount}
          size={size}
          last={index === sizes.length - 1}
        />
      ))}
      <TableInsertButtons {...props} />
    </div>
  )
}

function TableInsertButtons(props: ContentsProps): ReactNode {
  const { orientation, compact, disabled, points, hovered, target, onReveal } = props
  const text = useBlogTranslation('editor').t
  const row = orientation === 'row'
  const count = row ? props.geometry.rowCount : props.geometry.columnCount
  const full = count >= (row ? 100 : 20)
  return points.map((point, index) => (
    <button
      key={`${target.id}-${orientation}-insert-${point}`}
      type="button"
      tabIndex={0}
      className={cn(tableInsertClass, hovered === index && 'pointer-events-auto opacity-100')}
      style={insertBounds(props, point)}
      aria-label={text(row ? 'insertTableRow' : 'insertTableColumn', { number: boundaryPosition(props, index) + 1 })}
      data-table-insert-row={row ? index : undefined}
      data-table-insert-column={row ? undefined : index}
      disabled={disabled || full}
      onFocus={() => {
        onReveal(index)
        if (!row) {
          revealColumnBoundary(target.viewport, point, compact ? 44 : 24)
        }
      }}
      onClick={() => insertBoundary(props, index)}
      onKeyDownCapture={event => activateBoundary(event, props, index)}
    >
      <Plus size={14} aria-hidden="true" />
    </button>
  ))
}

function insertBounds({ orientation, compact, geometry }: BarProps, point: number): CSSProperties {
  const row = orientation === 'row'
  const total = row ? geometry.height : geometry.width
  const half = compact ? 22 : 12
  const offset = Math.max(half, Math.min(total - half, point))
  const position = row ? { left: '50%', top: offset } : { left: offset, top: '50%' }
  return { ...position, transform: 'translate(-50%,-50%)' }
}

function revealColumnBoundary(viewport: HTMLElement, point: number, plusSize: number): void {
  const scroll = viewport.scrollLeft
  const width = viewport.clientWidth
  if (point < scroll + plusSize || point > scroll + width - plusSize) {
    viewport.scrollTo({ left: point - width / 2 })
  }
}

function insertBoundary(props: ContentsProps, boundary: number): void {
  const { editor, target, orientation, disabled, sizes } = props
  if (sizes.length > 0) {
    const after = boundary === sizes.length
    const group = after ? boundary - 1 : boundary
    const index = orientation === 'row' ? props.geometry.rowIndexes[group] ?? group : group
    addTableSegment({ editor, target, orientation, index, disabled }, !after)
  }
}

function boundaryPosition({ orientation, geometry }: ContentsProps, index: number): number {
  if (orientation === 'row') {
    return geometry.rowIndexes[index] ?? geometry.rowCount
  }
  return geometry.columnStarts[index] ?? geometry.columnCount
}

function activateBoundary(event: KeyboardEvent<HTMLButtonElement>, props: ContentsProps, index: number): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    event.stopPropagation()
    insertBoundary(props, index)
  }
}
