import { useLayoutEffect, useRef } from 'react'

export type EditorPopoverFocus = {
  onOpenAutoFocus: (event: Event) => void
  onInteractOutside: (event: Event) => void
  onCloseAutoFocus: (event: Event) => void
}

// Keep this hook in the owner, outside the portal's Presence lifecycle.
export function useEditorPopoverFocus(open: boolean, close: (restoreFocus: boolean) => void): EditorPopoverFocus {
  const liveRef = useRef(true)
  const openRef = useRef(open)
  const latestRef = useRef<EventTarget | null>(null)
  const sessionsRef = useRef(new WeakMap<EventTarget, { outside: boolean, trigger: Element | null }>())
  useLayoutEffect(() => {
    liveRef.current = true
    return () => {
      liveRef.current = false
    }
  }, [])
  useLayoutEffect(() => {
    openRef.current = open
    const session = latestRef.current === null ? undefined : sessionsRef.current.get(latestRef.current)
    if (open && session !== undefined) {
      session.outside = false
    }
  }, [open])
  return {
    onOpenAutoFocus: (event) => {
      if (event.target !== null) {
        latestRef.current = event.target
        sessionsRef.current.set(event.target, { outside: false, trigger: null })
      }
    },
    onInteractOutside: (event) => {
      const content = latestRef.current
      const session = content === null ? undefined : sessionsRef.current.get(content)
      if (session !== undefined && content !== null) {
        // Radix keeps the popover open when its own trigger receives focus.
        const trigger = triggerFor(content, event.target)
        session.outside = trigger === null
        if (trigger !== null) {
          // aria-controls disappears when open becomes false, before cleanup.
          session.trigger = trigger
        }
      }
    },
    onCloseAutoFocus: (event) => {
      event.preventDefault()
      if (!liveRef.current || openRef.current || latestRef.current !== event.target || event.target === null) {
        return
      }
      const session = sessionsRef.current.get(event.target)
      sessionsRef.current.delete(event.target)
      latestRef.current = null
      close(session?.outside !== true && focusStillBelongsTo(event.target, session?.trigger ?? null))
    },
  }
}

function focusStillBelongsTo(closing: EventTarget, trigger: Element | null): boolean {
  const active = document.activeElement
  return active === null || active === document.body
    || (closing instanceof HTMLElement && closing.contains(active)) || trigger?.contains(active) === true
}

function triggerFor(content: EventTarget, target: EventTarget | null): Element | null {
  const control = target instanceof Element ? target.closest('[aria-controls]') : null
  return content instanceof HTMLElement && content.id !== ''
    && control?.getAttribute('aria-controls')?.split(/\s+/).includes(content.id) === true
    ? control
    : null
}
