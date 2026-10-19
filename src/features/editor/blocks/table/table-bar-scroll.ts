import type { RefObject, UIEvent } from 'react'
import type { TableTarget } from '@/features/editor/blocks/table/table-controls-model'
import { useEffect, useRef } from 'react'

// Follow the live native viewport rather than a previous animation-frame snapshot.
// Only independent bar scrolling (for example keyboard focus) flows back to it.
export function useTableBarScroll(
  target: TableTarget,
  row: boolean,
  barRef: RefObject<HTMLDivElement | null>,
): (event: UIEvent<HTMLDivElement>) => void {
  const syncedLeftRef = useRef(0)
  useEffect(() => {
    if (row) {
      return
    }
    const sync = (): void => {
      const bar = barRef.current
      if (bar !== null) {
        bar.scrollTo({ left: target.viewport.scrollLeft })
        syncedLeftRef.current = bar.scrollLeft
      }
    }
    target.viewport.addEventListener('scroll', sync, { passive: true })
    sync()
    return () => target.viewport.removeEventListener('scroll', sync)
  }, [
    target,
    row,
    barRef,
  ])
  return (event) => {
    const left = event.currentTarget.scrollLeft
    if (!row && Math.abs(left - syncedLeftRef.current) > 1) {
      target.viewport.scrollTo({ left })
    }
  }
}
