'use client'
import type { RefObject } from 'react'
import type { HistoryGuardResolver } from './history-navigation'
import { createContext, use, useEffect, useLayoutEffect } from 'react'

export type Guard = (href: string) => void
export type HistoryGuardRegistration = { resolve: HistoryGuardResolver, cancel: () => void }
export const NavigationGuardContext = createContext<RefObject<Guard | null> | null>(null)
export const HistoryGuardContext = createContext<RefObject<HistoryGuardRegistration | null> | null>(null)
export const HistoryCancelContext = createContext<(() => void) | null>(null)
function ignoreCancel(): void {}

export function useHistoryNavigationGuard(guard: HistoryGuardResolver, cancelled: () => void): () => void {
  const contextRef = use(HistoryGuardContext)
  const cancel = use(HistoryCancelContext)
  useLayoutEffect(() => {
    if (contextRef === null) {
      return
    }
    const registration = { resolve: guard, cancel: cancelled }
    contextRef.current = registration
    return () => {
      if (contextRef.current === registration) {
        contextRef.current = null
      }
    }
  }, [
    contextRef,
    guard,
    cancelled,
  ])
  return cancel ?? ignoreCancel
}

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
