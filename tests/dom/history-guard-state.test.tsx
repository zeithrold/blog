import type { ReactNode, RefObject } from 'react'
import type { HistoryEntry, HistoryGuard } from '@/shared/admin/history-navigation'
import type { Guard, HistoryGuardRegistration } from '@/shared/admin/navigation-guard-context'
import { useEffect } from 'react'
import { afterEach, expect, it } from 'vitest'
import { HistoryNavigation } from '@/shared/admin/history-navigation'
import {
  HistoryCancelContext,
  HistoryGuardContext,
  NavigationGuardContext,
  useHistoryNavigationGuard,
  useInternalNavigationGuard,
} from '@/shared/admin/navigation-guard-context'
import { mount, resetGuardDom, settle } from './history-guard-support'

/**
 * The navigation guard's registration and traversal decisions, with the real hooks.
 *
 * These are the interfaces and the decision logic, not the editor's departure
 * policy: `blocked` here is the caller's own flag (the real `EditorNavigation`
 * always passes `true` and lets `source.blocked()`/`request` decide), and the
 * cancel functions are the two context callbacks a refusal runs. The policy below
 * those interfaces is proved in `history-departure-policy.test.tsx`, over the real
 * `EditorNavigation`; the focus hand-back stays with the Playwright case.
 */

afterEach(resetGuardDom)

/** The editor's own registration: one guard, one history registration. */
function Departing({ blocked, request }: { blocked: boolean, request: (href: string) => void }): ReactNode {
  useInternalNavigationGuard(blocked, request)
  return null
}

/** The editor registers the resolver and keeps the cancel it will run on refusal. */
function Guarding({ guard, cancelled, cancelRef }: {
  guard: HistoryGuard
  cancelled: () => void
  cancelRef: RefObject<(() => void) | null>
}): ReactNode {
  const cancel = useHistoryNavigationGuard(() => guard, cancelled)
  useEffect(() => {
    cancelRef.current = cancel
  }, [cancel, cancelRef])
  return null
}

it('hands the context the guard the caller registers and clears it when unregistered', async () => {
  const guardRef: RefObject<Guard | null> = { current: null }
  const requested: string[] = []
  const request = (href: string): void => {
    requested.push(href)
  }
  const view = mount(
    <NavigationGuardContext value={guardRef}>
      <Departing blocked request={request} />
    </NavigationGuardContext>,
  )
  await settle()
  // The registered guard is the request a navigation will carry.
  expect(guardRef.current).toBe(request)
  guardRef.current?.('/admin/catalogs/tags')
  expect(requested).toEqual(['/admin/catalogs/tags'])
  // The caller's own flag decides; the hook only mirrors it into the context.
  view.render(
    <NavigationGuardContext value={guardRef}>
      <Departing blocked={false} request={request} />
    </NavigationGuardContext>,
  )
  await settle()
  expect(guardRef.current).toBeNull()
})

it('exposes the context cancel and the registration cancel a refusal runs', async () => {
  const historyRef: RefObject<HistoryGuardRegistration | null> = { current: null }
  const cancelRef: RefObject<(() => void) | null> = { current: null }
  let driverCancels = 0
  let departureCancels = 0
  const guard: HistoryGuard = (_href: string, _commit: () => void): void => {
    /* the editor decides */
  }
  mount(
    <HistoryGuardContext value={historyRef}>
      <HistoryCancelContext value={() => {
        driverCancels += 1
      }}
      >
        <Guarding
          guard={guard}
          cancelled={() => {
            departureCancels += 1
          }}
          cancelRef={cancelRef}
        />
      </HistoryCancelContext>
    </HistoryGuardContext>,
  )
  await settle()
  // The browser asks this resolver before it traverses away.
  expect(historyRef.current?.resolve()).toBe(guard)
  // A refusal runs the context cancel, which asks the driver to stop ...
  cancelRef.current?.()
  expect(driverCancels).toBe(1)
  // ... and a driver-side cancel runs the departure controller's own cancel.
  historyRef.current?.cancel()
  expect(departureCancels).toBe(1)
  // The registration survives a refusal, so the resolver is still available.
  expect(historyRef.current?.resolve()).toBe(guard)
})

it('requests the chosen target, stays when it is refused and moves when it is approved', () => {
  // Entries carry the absolute URL a real `location.href` has.
  const visible: HistoryEntry = { href: 'http://127.0.0.1:8800/admin/documents/newer', position: { session: 'tab', index: 2 } }
  const older: HistoryEntry = { href: 'http://127.0.0.1:8800/admin/documents/older', position: { session: 'tab', index: 1 } }
  const moves: Array<{ delta: number, target: string }> = []
  const requested: string[] = []
  const commits: Array<() => void> = []
  let current = visible
  const navigation = new HistoryNavigation({
    read: () => current,
    go: (delta, target) => {
      moves.push({ delta, target: target.href })
    },
    guard: () => (href, commit) => {
      requested.push(href)
      commits.push(commit)
    },
  })
  // A traversal to the older document asks the editor before it leaves.
  current = older
  expect(navigation.pop()).toBe(true)
  expect(requested).toEqual([older.href])
  // The case marks the pop as the guard's own repair, which the browser driver
  // derives from the Navigation API; jsdom supplies that marker, it cannot derive it.
  current = visible
  expect(navigation.pop(true)).toBe(true)
  expect(moves).toEqual([
    { delta: 1, target: visible.href },
  ])
  // "Stay here" voids the pending approval: a late commit moves nothing.
  navigation.cancel()
  commits[0]?.()
  expect(moves).toHaveLength(1)
  // The next attempt is asked again: refusing did not disarm the guard.
  moves.length = 0
  requested.length = 0
  commits.length = 0
  current = older
  expect(navigation.pop()).toBe(true)
  expect(requested).toEqual([older.href])
  // The repair lands, then the caller approves the departure it was asked about.
  current = visible
  expect(navigation.pop(true)).toBe(true)
  commits[0]?.()
  // Approving goes to the target the reader chose, not back where they were.
  expect(moves).toEqual([
    { delta: 1, target: visible.href },
    { delta: -1, target: older.href },
  ])
})
