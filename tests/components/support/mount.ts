import type { Page } from '@playwright/test'
import type { ComponentLocale, ComponentMode, ComponentSurface } from '../src/contract'
import { readComponentOptions } from '../src/contract'

export { COMPONENT_TEST_FIXTURES } from '../src/fixtures'
export type { ComponentLocale, ComponentMode, ComponentSurface }

export type MountSurfaceOptions = {
  surface: ComponentSurface
  locale?: ComponentLocale
  mode?: ComponentMode
  /**
   * Document path the surface is mounted on. Shell chrome reads the real
   * pathname, so an admin surface mounts at the admin route it renders.
   */
  route?: string
}

const mountTimeout = 15000

/**
 * Mount one production surface in its own page against the current Playwright
 * baseURL. Only the initial React commit is awaited: loading, network and
 * readiness assertions stay in the spec so held responses can be observed.
 */
export async function mountSurface(page: Page, options: MountSurfaceOptions): Promise<void> {
  const query = new URLSearchParams({
    surface: options.surface,
    locale: options.locale ?? 'en',
    mode: options.mode ?? 'light',
  })
  // Reject unsupported values before navigating, so a typo fails immediately
  // instead of waiting for a harness timeout.
  const normalized = readComponentOptions(query)
  await page.goto(`${options.route ?? '/'}?${query.toString()}`)
  await page.waitForFunction(
    () => {
      const state = document.documentElement.dataset.componentHarness
      return state === 'mounted' || state === 'error'
    },
    undefined,
    { timeout: mountTimeout },
  )
  const state = await page.evaluate(() => document.documentElement.dataset.componentHarness)
  if (state === 'error') {
    const message = await page.locator('[data-component-harness-error]').textContent({ timeout: 2000 })
    throw new Error(`Component harness failed to mount: ${message ?? 'unknown error'}`)
  }
  await page.locator(`[data-component-surface="${normalized.surface}"]`).waitFor({ state: 'attached' })
}
