import type { ReactNode, RefObject } from 'react'
import type { Guard } from '@/shared/admin/navigation-guard-context'
import { afterEach, expect, it } from 'vitest'
import { NavigationGuardProvider } from '@/shared/admin/navigation-guard'
import { NavigationGuardContext, useInternalNavigationGuard } from '@/shared/admin/navigation-guard-context'
import { mount, resetMounted, settle } from './mount'

/**
 * The link guard is all that remains of in-app departure control: one context,
 * one registration hook. It neither owns history state nor listens for browser
 * navigation, which is what keeps Back/Forward native.
 */

afterEach(resetMounted)

function Departing({ blocked, guard }: { blocked: boolean, guard: Guard }): ReactNode {
  useInternalNavigationGuard(blocked, guard)
  return null
}

it('registers the guard in-app links consult, and clears it while leaving is allowed', async () => {
  const guardRef: RefObject<Guard | null> = { current: null }
  const requested: string[] = []
  const guard = (href: string): void => {
    requested.push(href)
  }
  const view = mount(
    <NavigationGuardContext value={guardRef}>
      <Departing blocked guard={guard} />
    </NavigationGuardContext>,
  )
  await settle()
  // The registered guard is what a guarded link hands its destination to.
  expect(guardRef.current).toBe(guard)
  guardRef.current?.('/admin/media')
  expect(requested).toEqual(['/admin/media'])
  // The caller's own condition decides; the hook only mirrors it into the context.
  view.render(
    <NavigationGuardContext value={guardRef}>
      <Departing blocked={false} guard={guard} />
    </NavigationGuardContext>,
  )
  await settle()
  expect(guardRef.current).toBeNull()
})

it('leaves history state and browser popstate untouched', async () => {
  mount(<NavigationGuardProvider><span>content</span></NavigationGuardProvider>)
  await settle()
  window.history.replaceState({ form: 'draft' }, '')
  // No session marker and no position are written over the router's own state.
  expect(window.history.state).toEqual({ form: 'draft' })
  const pop = new Event('popstate', { cancelable: true })
  window.dispatchEvent(pop)
  expect(pop.defaultPrevented).toBe(false)
})
