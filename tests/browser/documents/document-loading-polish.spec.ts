import type { Locator, Page } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { documentListReady, writeDocument } from '~/tests/support/browser/document'
import { trackPrefetchBatches } from '~/tests/support/browser/prefetch'
import { expect, test } from '~/tests/support/browser/test'

const copy = {
  en: {
    loading: 'Loading documents…',
    refresh: 'Refresh list',
  },
  zh: {
    loading: '正在加载文档…',
    refresh: '刷新列表',
  },
} as const

// Nothing here decides which page errors count: every uncaught error fails the test.
function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  return errors
}

async function expectIndicatorSpacing(status: Locator): Promise<void> {
  const geometry = await status.evaluate((element) => {
    const glyph = element.querySelector('svg')
    const icon = glyph?.getBoundingClientRect()
    const text = element.querySelector('span')?.getBoundingClientRect()
    if (glyph === null || icon === undefined || text === undefined) {
      throw new Error('Missing loading indicator')
    }
    return {
      gap: text.x - icon.x - icon.width,
      offset: Math.abs(text.y + text.height / 2 - icon.y - icon.height / 2),
      animation: getComputedStyle(glyph).animationName,
    }
  })
  expect(geometry.gap).toBeGreaterThanOrEqual(8)
  expect(geometry.offset).toBeLessThan(2)
  expect(geometry.animation).toBe('none')
}

async function prepareList(page: Page, locale: 'en' | 'zh', width: number): Promise<{
  title: string
  prefetches: ReturnType<typeof trackPrefetchBatches>
}> {
  // Tracked before the first navigation so every batch this page starts is known.
  const prefetches = trackPrefetchBatches(page)
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const initial = emptyDocument()
  initial.meta.title = `Loading layout ${crypto.randomUUID()}`
  initial.meta.slug = `loading-layout-${crypto.randomUUID()}`
  await writeDocument(page, initial)
  // The polish surface deliberately unloads documents, and the shell's prefetches are
  // the app's own work in flight at that moment. Waiting for them, and only them, is
  // what keeps the unload from cancelling them mid-request.
  await prefetches.settle()
  await page.goto('/admin')
  await documentListReady(page, initial.meta.title)
  if (locale === 'zh') {
    await page.getByRole('combobox', { name: 'Language', exact: true }).click()
    await page.getByRole('option', { name: '简体中文', exact: true }).click()
    // Preferences live in a cookie, so the server render reads them only after a
    // reload; the root attributes show the preference itself was committed.
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await prefetches.settle()
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await documentListReady(page, initial.meta.title)
    await page.getByRole('button', { name: '外观', exact: true }).click()
    await page.getByRole('menuitemradio', { name: '深色', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-frontend-mode', 'dark')
  }
  return { title: initial.meta.title, prefetches }
}

for (const [locale, width] of [
  ['en', 1440],
  ['zh', 320],
] as const) {
  test(`document loading and refresh stay readable in ${locale} at ${width}px`, async ({ page }, info) => {
    const errors = collectErrors(page)
    const { title, prefetches } = await prepareList(page, locale, width)
    for (const refresh of [false, true]) {
      let release = (): void => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route(/\/api\/admin\/documents(?:\?|$)/, async (route) => {
        await gate
        await route.continue()
      })
      try {
        if (refresh) {
          await page.getByRole('button', { name: copy[locale].refresh, exact: true }).click()
        }
        else {
          await prefetches.settle()
          await page.reload()
        }
        const loading = page.locator('.document-loading')
        const status = loading.getByRole('status')
        await expect(status).toHaveText(copy[locale].loading)
        await expect(page.locator('.document-list-panel')).toHaveAttribute('aria-busy', 'true')
        await expect(loading.locator('.document-skeleton-row')).toHaveCount(refresh ? 0 : 4)
        if (refresh) {
          await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible()
        }
        else {
          await expect(page.locator('.document-list-summary')).not.toContainText(/^0 /)
        }
        await expectIndicatorSpacing(status)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await assertAccessible(page, info, { label: `document-loading-${locale}-${String(refresh)}` })
        await page.screenshot({ path: info.outputPath(`document-loading-${locale}-${String(refresh)}.png`) })
      }
      finally {
        release()
      }
      // The held list request has answered: the panel is readable and renders its
      // rows again, which is the ready state, not network silence.
      await documentListReady(page, title)
      await page.unroute(/\/api\/admin\/documents(?:\?|$)/)
    }
    // The held requests above were the last traffic this test started. One more
    // answered refresh proves the surface still works after them and gives the
    // page-error listener a business-anchored window.
    const answered = page.waitForResponse(response => /\/api\/admin\/documents(?:\?|$)/.test(response.url())
      && response.request().method() === 'GET')
    await page.getByRole('button', { name: copy[locale].refresh, exact: true }).click()
    expect((await answered).ok()).toBe(true)
    await documentListReady(page, title)
    expect(errors).toEqual([])
  })
}

// The surface keeps every uncaught error, including the wording a cancelled prefetch
// produces. A filter that excused that text by itself would pass this test only if the
// listener stopped reporting it, which is exactly what this asserts against.
test('a cancelled-prefetch message stays a failure on the loading surface', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/__fixture/login')
  await documentListReady(page)
  const forged = '/127.0.0.1:9/admin/documents?_rsc=forged due to access control checks.'
  const raised = page.waitForEvent('pageerror')
  await page.evaluate((message) => {
    setTimeout(() => {
      throw new Error(message)
    })
  }, forged)
  expect((await raised).message).toBe(forged)
  expect(errors).toEqual([forged])
})
