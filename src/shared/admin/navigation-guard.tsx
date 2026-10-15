'use client'
import type { ComponentProps, ReactNode } from 'react'
import type { HistoryNavigation } from './history-navigation'
import type { Guard, HistoryGuardRegistration } from './navigation-guard-context'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { use, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { HistoryBrowser } from './history-browser'
import { HistoryCancelContext, HistoryGuardContext, NavigationGuardContext } from './navigation-guard-context'

export function NavigationGuardProvider({ children }: { children: ReactNode }): ReactNode {
  const guardRef = useRef<Guard | null>(null)
  const historyRef = useRef<HistoryGuardRegistration | null>(null)
  const navigationRef = useRef<HistoryNavigation | null>(null)
  const cancelHistory = useCallback(() => navigationRef.current?.cancel(), [])
  const pathname = usePathname()
  const search = useSearchParams().toString()
  useLayoutEffect(() => {
    const driver = new HistoryBrowser(
      () => historyRef.current?.resolve() ?? null,
      () => historyRef.current?.cancel(),
    )
    const { navigation, pop } = driver
    navigationRef.current = navigation
    window.addEventListener('blog:history-pop', pop)
    window.addEventListener('blog:history-write', navigation.written)
    window.addEventListener('hashchange', navigation.sync)
    return () => {
      driver.dispose()
      window.removeEventListener('blog:history-pop', pop)
      window.removeEventListener('blog:history-write', navigation.written)
      window.removeEventListener('hashchange', navigation.sync)
    }
  }, [])
  useEffect(() => navigationRef.current?.sync(), [pathname, search])
  return (
    <NavigationGuardContext value={guardRef}>
      <HistoryGuardContext value={historyRef}>
        <HistoryCancelContext value={cancelHistory}>{children}</HistoryCancelContext>
      </HistoryGuardContext>
    </NavigationGuardContext>
  )
}

export function GuardedLink({ deferGuard, ...props }: Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'> & {
  href: string
  deferGuard?: (request: () => void) => void
}): ReactNode {
  const guardRef = use(NavigationGuardContext)
  return (
    <Link
      {...props}
      onNavigate={(event) => {
        const destination = new URL(props.href, window.location.href)
        const current = window.location
        if (guardRef?.current !== null && guardRef?.current !== undefined
          && (destination.pathname !== current.pathname || destination.search !== current.search)) {
          event.preventDefault()
          const guard = guardRef.current
          const request = (): void => guard(`${destination.pathname}${destination.search}${destination.hash}`)
          if (deferGuard !== undefined) {
            deferGuard(request)
          }
          else {
            request()
          }
        }
      }}
    />
  )
}
