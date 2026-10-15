import type { RefObject } from 'react'
import { createContext, use, useCallback, useId, useMemo, useRef, useState } from 'react'

export type ReferencePageHost = {
  outlet: HTMLDivElement | null
  titleId: string
  descriptionId: string
  enter: () => void
  leave: () => void
  registerClose: (close: (() => void) | null) => void
}
export const ReferencePageContext = createContext<ReferencePageHost | null>(null)
export function useReferencePage(): ReferencePageHost | null {
  return use(ReferencePageContext)
}

export function useReferencePageHost(contentRef: RefObject<HTMLDivElement | null>): {
  active: boolean
  host: ReferencePageHost
  setOutlet: (element: HTMLDivElement | null) => void
  requestBack: () => void
} {
  const [active, setActive] = useState(false)
  const [outlet, setOutlet] = useState<HTMLDivElement | null>(null)
  const closeRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef(0)
  const titleId = useId()
  const descriptionId = useId()
  const viewport = useCallback((): HTMLElement | null => contentRef.current
    ?.querySelector('.inspector-scroll .ztd-scroll-viewport') ?? null, [contentRef])
  const enter = useCallback((): void => {
    scrollRef.current = viewport()?.scrollTop ?? 0
    setActive(true)
  }, [viewport])
  const leave = useCallback((): void => {
    setActive(false)
    requestAnimationFrame(() => {
      const scroll = viewport()
      if (scroll !== null) {
        scroll.scrollTop = scrollRef.current
      }
    })
  }, [viewport])
  const registerClose = useCallback((fn: (() => void) | null): void => {
    closeRef.current = fn
  }, [])
  const host = useMemo(() => ({ outlet, titleId, descriptionId, enter, leave, registerClose }), [
    outlet,
    titleId,
    descriptionId,
    enter,
    leave,
    registerClose,
  ])
  return { active, host, setOutlet, requestBack: () => closeRef.current?.() }
}
