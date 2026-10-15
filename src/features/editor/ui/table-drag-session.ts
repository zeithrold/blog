import type { DragPoint } from '@/features/editor/ui/table-drag-geometry'

type SessionOptions = {
  event: PointerEvent
  button: HTMLButtonElement
  allowed: boolean
  start: () => void
  frame: (point: DragPoint, elapsed: number) => void
  finish: (point: DragPoint | null) => void
  tap: () => void
}

export function startTableDragSession(options: SessionOptions): () => void {
  const { event, button } = options
  let point = { x: event.clientX, y: event.clientY }
  let active = false
  let ended = false
  let moved = false
  let armed = event.pointerType !== 'touch'
  let frame = 0
  let time = performance.now()
  const timer = window.setTimeout(() => {
    armed = true
  }, 300)
  const tick = (now: number): void => {
    options.frame(point, Math.min(32, now - time))
    time = now
    if (!ended) {
      frame = requestAnimationFrame(tick)
    }
  }
  let cleanup = (): void => {}
  const finish = (commit: boolean): void => {
    if (ended) {
      return
    }
    ended = true
    cleanup()
    if (active) {
      options.finish(commit ? point : null)
    }
    else if (commit && !moved) {
      options.tap()
    }
  }
  const move = (next: PointerEvent): void => {
    if (next.pointerId !== event.pointerId) {
      return
    }
    point = { x: next.clientX, y: next.clientY }
    const threshold = event.pointerType === 'touch' ? 8 : 6
    if (!active && Math.hypot(point.x - event.clientX, point.y - event.clientY) >= threshold) {
      moved = true
      if (!armed || !options.allowed) {
        finish(false)
        return
      }
      active = true
      options.start()
      frame = requestAnimationFrame(tick)
    }
    if (active) {
      next.preventDefault()
    }
  }
  const handlers = sessionHandlers(event.pointerId, move, finish)
  cleanup = bindSessionEvents(button, handlers, () => {
    releaseSession({ timer, frame, button, pointerId: event.pointerId })
  })
  button.setPointerCapture(event.pointerId)
  return () => finish(false)
}

function bindSessionEvents(button: HTMLElement, handlers: {
  move: (event: PointerEvent) => void
  up: (event: PointerEvent) => void
  cancel: () => void
  key: (event: KeyboardEvent) => void
  visibility: () => void
}, dispose: () => void): () => void {
  document.addEventListener('pointermove', handlers.move, { passive: false })
  document.addEventListener('pointerup', handlers.up)
  document.addEventListener('pointercancel', handlers.cancel)
  document.addEventListener('keydown', handlers.key, true)
  document.addEventListener('visibilitychange', handlers.visibility)
  window.addEventListener('blur', handlers.cancel)
  button.addEventListener('lostpointercapture', handlers.cancel)
  return () => {
    document.removeEventListener('pointermove', handlers.move)
    document.removeEventListener('pointerup', handlers.up)
    document.removeEventListener('pointercancel', handlers.cancel)
    document.removeEventListener('keydown', handlers.key, true)
    document.removeEventListener('visibilitychange', handlers.visibility)
    window.removeEventListener('blur', handlers.cancel)
    button.removeEventListener('lostpointercapture', handlers.cancel)
    dispose()
  }
}

function sessionHandlers(pointerId: number, move: (event: PointerEvent) => void, finish: (commit: boolean) => void) {
  const up = (next: PointerEvent): void => {
    if (next.pointerId === pointerId) {
      finish(true)
    }
  }
  const cancel = (): void => finish(false)
  const key = (next: KeyboardEvent): void => {
    if (next.key === 'Escape') {
      next.preventDefault()
      next.stopPropagation()
      cancel()
    }
  }
  const visibility = (): void => {
    if (document.hidden) {
      cancel()
    }
  }
  return { move, up, cancel, key, visibility }
}

function releaseSession({ timer, frame, button, pointerId }: {
  timer: number
  frame: number
  button: HTMLElement
  pointerId: number
}): void {
  clearTimeout(timer)
  cancelAnimationFrame(frame)
  if (button.hasPointerCapture(pointerId)) {
    button.releasePointerCapture(pointerId)
  }
}
