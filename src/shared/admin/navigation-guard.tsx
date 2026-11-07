'use client'
import type { ComponentProps, ReactNode } from 'react'
import type { Guard } from './navigation-guard-context'
import Link from 'next/link'
import { use, useRef } from 'react'
import { NavigationGuardContext } from './navigation-guard-context'

/**
 * Holds the guard in-app links consult. It deliberately covers nothing else: no
 * history state, no pop listeners and no router interception, so browser
 * Back/Forward, refresh and close stay native navigations.
 */
export function NavigationGuardProvider({ children }: { children: ReactNode }): ReactNode {
  const guardRef = useRef<Guard | null>(null)
  return <NavigationGuardContext value={guardRef}>{children}</NavigationGuardContext>
}

/**
 * An in-app link that asks the registered guard first. The guard receives the
 * destination and decides; when it accepts, the departure itself is performed by
 * the owner of that guard (for the editor document, a document navigation).
 * Modified and non-primary clicks never reach `onNavigate`, so they keep the
 * browser's own behavior.
 */
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
