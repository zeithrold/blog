'use client'
import type { RefObject } from 'react'
import { createContext, use, useEffect } from 'react'

/** What an in-app link asks before it hands the destination to the route change. */
export type Guard = (href: string) => void
export const NavigationGuardContext = createContext<RefObject<Guard | null> | null>(null)

/**
 * Registers the guard in-app links consult. A surface that must not lose local
 * state registers one while it is unsafe to leave; without a registration links
 * keep their ordinary framework navigation.
 */
export function useInternalNavigationGuard(blocked: boolean, guard: Guard): void {
  const contextRef = use(NavigationGuardContext)
  useEffect(() => {
    if (contextRef === null || !blocked) {
      return
    }
    contextRef.current = guard
    return () => {
      if (contextRef.current === guard) {
        contextRef.current = null
      }
    }
  }, [
    contextRef,
    blocked,
    guard,
  ])
}
