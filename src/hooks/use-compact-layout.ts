'use client'

import { useCallback, useSyncExternalStore } from 'react'

const serverSnapshot = (): boolean => false

export function useCompactLayout(maxWidth = 1100): boolean {
  const query = `(max-width: ${maxWidth}px)`
  const subscribe = useCallback((listener: () => void) => {
    const media = window.matchMedia(query)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])
  const snapshot = useCallback(() => window.matchMedia(query).matches, [query])
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}
