import type { KeyboardEvent, PointerEvent, ReactNode, RefObject } from 'react'
import type { TableGeometry, TableTarget } from '@/features/editor/ui/table-controls-model'
import { useEffect, useRef } from 'react'
import { tableScrollbarClass } from '@/features/editor/ui/table-controls-utilities'
import { useBlogTranslation } from '@/i18n/use-translation'

type ScrollGesture = { pointerId: number, x: number, scroll: number, scale: number }
type ScrollProps = { target: TableTarget, geometry: TableGeometry }

export function TableScrollbar({ target, geometry }: ScrollProps): ReactNode {
  const text = useBlogTranslation('editor').t
  const gestureRef = useRef<ScrollGesture | null>(null)
  const maximum = Math.max(0, target.viewport.scrollWidth - target.viewport.clientWidth)
  const id = `editor-table-${target.id}`
  useEffect(() => {
    // Native TableView observes inner viewport attributes as document changes.
    // Its outer wrapper is a safe control target containing the scroll viewport.
    const previous = target.wrapper.id
    target.wrapper.setAttribute('id', id)
    return () => {
      target.wrapper.setAttribute('id', previous)
    }
  }, [target, id])
  if (maximum <= 1) {
    return null
  }
  const ratio = Math.max(0.08, geometry.viewportWidth / target.viewport.scrollWidth)
  const travel = geometry.viewportWidth * (1 - ratio)
  const left = geometry.scrollLeft / maximum * travel
  return (
    <div
      role="scrollbar"
      tabIndex={0}
      aria-label={text('scrollTableHorizontally')}
      aria-controls={id}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={Math.round(maximum)}
      aria-valuenow={Math.round(geometry.scrollLeft)}
      className={tableScrollbarClass}
      style={{ width: geometry.viewportWidth }}
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onPointerDown={event => beginScroll(event, target.viewport, gestureRef, { ratio, travel, maximum })}
      onPointerMove={event => moveScroll(event, target.viewport, gestureRef)}
      onPointerUp={event => finishScroll(event, gestureRef)}
      onPointerCancel={event => finishScroll(event, gestureRef)}
      onLostPointerCapture={() => { gestureRef.current = null }}
      onKeyDownCapture={event => scrollWithKey(event, target, maximum)}
    >
      <div
        data-slot="table-scroll-thumb"
        className="h-full rounded-full bg-muted-foreground/60 hover:bg-muted-foreground"
        style={{ width: geometry.viewportWidth * ratio, transform: `translateX(${left}px)` }}
      />
    </div>
  )
}

function beginScroll(
  event: PointerEvent<HTMLDivElement>,
  viewport: HTMLElement,
  gestureRef: RefObject<ScrollGesture | null>,
  { ratio, travel, maximum }: { ratio: number, travel: number, maximum: number },
): void {
  if (event.button !== 0) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  const track = event.currentTarget
  track.focus({ preventScroll: true })
  track.setPointerCapture(event.pointerId)
  if (!(event.target instanceof Element) || event.target.closest('[data-slot=table-scroll-thumb]') === null) {
    const position = event.clientX - track.getBoundingClientRect().left - track.clientWidth * ratio / 2
    viewport.scrollTo({ left: position / Math.max(1, travel) * maximum })
  }
  gestureRef.current = {
    pointerId: event.pointerId,
    x: event.clientX,
    scroll: viewport.scrollLeft,
    scale: maximum / Math.max(1, travel),
  }
}

function moveScroll(
  event: PointerEvent<HTMLDivElement>,
  viewport: HTMLElement,
  gestureRef: RefObject<ScrollGesture | null>,
): void {
  const drag = gestureRef.current
  if (drag?.pointerId === event.pointerId) {
    event.preventDefault()
    event.stopPropagation()
    viewport.scrollTo({ left: drag.scroll + (event.clientX - drag.x) * drag.scale })
  }
}

function finishScroll(event: PointerEvent<HTMLDivElement>, gestureRef: RefObject<ScrollGesture | null>): void {
  if (gestureRef.current?.pointerId === event.pointerId) {
    gestureRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
}

function scrollWithKey(event: KeyboardEvent<HTMLDivElement>, target: TableTarget, maximum: number): void {
  const deltas: Record<string, number> = {
    ArrowLeft: -40,
    ArrowRight: 40,
    PageUp: -target.viewport.clientWidth,
    PageDown: target.viewport.clientWidth,
    Home: -maximum,
    End: maximum,
  }
  const delta = deltas[event.key]
  if (delta !== undefined) {
    event.preventDefault()
    event.stopPropagation()
    target.viewport.scrollBy({ left: delta })
  }
}
