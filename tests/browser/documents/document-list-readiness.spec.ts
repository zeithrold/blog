import { emptyDocument } from '@/content/document'
import { documentListReady, writeDocument } from '~/tests/support/browser/document'
import { trackPrefetchBatches } from '~/tests/support/browser/prefetch'
import { expect, test } from '~/tests/support/browser/test'

// The admin shell prefetches the site root for its own navigation link, so every
// visit starts traffic that no surface on the list page waits for. A quiet-network
// wait sat behind that traffic — and behind the remote font stylesheet — long after
// the list had rendered, which is the wait this spec keeps honest.
const unrelatedPrefetch = /\/\?_rsc=/

test('list readiness does not wait for an unrelated request that never answers', async ({ page }) => {
  const document = emptyDocument()
  document.meta.title = `Readiness ${crypto.randomUUID()}`
  document.meta.slug = `readiness-${crypto.randomUUID()}`
  await writeDocument(page, document)
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let intercepted = (): void => {}
  const prefetching = new Promise<void>((resolve) => {
    intercepted = resolve
  })
  await page.route(unrelatedPrefetch, async (route) => {
    intercepted()
    await held
    // An expectation above can fail before the release point, when the page is gone.
    await route.continue().catch(() => {})
  })
  try {
    await page.goto('/admin')
    await documentListReady(page, document.meta.title)
    // The hold was in force before the list reported ready, which is the state a
    // quiet-network wait can never leave: it keeps restarting its idle window.
    await prefetching
    const answered = page.waitForResponse(response => response.url().endsWith('/api/admin/documents')
      && response.request().method() === 'GET')
    await page.getByRole('button', { name: 'Refresh list', exact: true }).click()
    expect((await answered).ok()).toBe(true)
    await documentListReady(page, document.meta.title)
    const resumed = page.waitForResponse(response => unrelatedPrefetch.test(response.url()))
    release()
    expect((await resumed).ok()).toBe(true)
  }
  finally {
    release()
    await page.unroute(unrelatedPrefetch)
  }
})

// The pre-unload wait covers the shell's own prefetches, and a prefetch that never
// answers must not hold the surface: the deadline returns, the list stays usable, and
// nothing about readiness depends on that request.
test('a prefetch that never answers cannot hold the surface hostage', async ({ page }) => {
  const prefetches = trackPrefetchBatches(page)
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(/[?&]_rsc=/, async (route) => {
    if (route.request().headers()['next-router-prefetch'] !== '1') {
      await route.continue()
      return
    }
    await held
    await route.continue().catch(() => {})
  })
  try {
    await page.goto('/__fixture/login')
    await documentListReady(page)
    // The marker decides what is tracked, so the wait is provably aimed at prefetches.
    expect(prefetches.observed()).toBeGreaterThan(0)
    const started = Date.now()
    expect(await prefetches.settle({ deadlineMs: 500 })).toBe('deadline')
    expect(Date.now() - started).toBeLessThan(5000)
    await expect(page.getByRole('searchbox', { name: 'Search by title', exact: true })).toBeEnabled()
  }
  finally {
    release()
    await page.unroute(/[?&]_rsc=/)
  }
})

test('the pre-unload deadline also bounds a paint that never completes', async ({ page }) => {
  const prefetches = trackPrefetchBatches(page)
  await page.goto('/__fixture/login')
  await documentListReady(page)
  const restore = await page.evaluateHandle(() => {
    const original = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = () => 0
    return () => {
      window.requestAnimationFrame = original
    }
  })
  try {
    const started = Date.now()
    expect(await prefetches.settle({ deadlineMs: 100 })).toBe('deadline')
    expect(Date.now() - started).toBeLessThan(5000)
  }
  finally {
    await restore.evaluate(callback => callback())
    await restore.dispose()
  }
})
