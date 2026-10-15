import { useLayoutEffect, useState } from 'react'

export function useEditorPopoverBoundary(open: boolean): { top: number, right: number, bottom: number, left: number } {
  const [top, setTop] = useState(8)
  useLayoutEffect(() => {
    if (!open) {
      return
    }
    const header = document.querySelector('.workspace-header')
    const update = (): void => {
      // eslint-disable-next-line react/set-state-in-effect -- Measure sticky DOM geometry before the popover paints.
      setTop(Math.max(8, (header?.getBoundingClientRect().bottom ?? 0) + 8))
    }
    update()
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    })
    if (header !== null) {
      observer.observe(header)
    }
    const appbar = document.querySelector('.ztd-application > .ztd-appbar')
    if (appbar !== null) {
      observer.observe(appbar)
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])
  return { top, right: 8, bottom: 8, left: 8 }
}
