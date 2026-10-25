import type { Locator } from '@playwright/test'
import { documentEntry, selectDocuments } from '~/tests/components/support/domain-fixtures'
import { documentsCopy } from '~/tests/components/support/expected-copy'
import { defer, serveApi, watchErrors } from '~/tests/components/support/http-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'
import { assertAccessible } from '~/tests/support/browser/accessibility'

// The indicator is a spinning glyph beside its label; reduced motion has to stop
// the spin while keeping the glyph and the text on one line.
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

for (const [locale, width] of [
  ['en', 1440],
  ['zh', 320],
] as const) {
  test(`document loading and refresh stay readable in ${locale} at ${width}px`, async ({ page }, info) => {
    const entry = documentEntry({ title: `Loading layout ${crypto.randomUUID()}` })
    const errors = watchErrors(page)
    let held = defer()
    const api = await serveApi(page, {
      'GET /api/admin/documents': async (call) => {
        await held.promise
        return selectDocuments([entry], call)
      },
    })
    try {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await mountSurface(page, { surface: 'documents', locale })
      const copy = documentsCopy[locale]
      const panel = page.locator('.document-list-panel')
      const loading = page.locator('.document-loading').getByRole('status')
      const link = page.getByRole('link', { name: entry.title, exact: true })

      for (const refresh of [false, true]) {
        if (refresh) {
          held = defer()
          await page.getByRole('button', { name: copy.refresh, exact: true }).click()
        }
        await expect(loading).toHaveText(copy.loading)
        await expect(panel).toHaveAttribute('aria-busy', 'true')
        await expect(page.locator('.document-skeleton-row')).toHaveCount(refresh ? 0 : 4)
        if (refresh) {
          // A refresh keeps the loaded rows and leaves the form usable.
          await expect(link).toBeVisible()
          await expect(page.getByRole('searchbox', { name: copy.search, exact: true })).toBeEnabled()
          await expect(page.getByRole('button', { name: copy.submit, exact: true })).toBeEnabled()
        }
        else {
          await expect(page.locator('.document-list-summary')).not.toContainText(/^0 /)
        }
        await expectIndicatorSpacing(loading)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await assertAccessible(page, info, { label: `document-loading-${locale}-${String(refresh)}` })
        await page.screenshot({ path: info.outputPath(`document-loading-${locale}-${String(refresh)}.png`) })
        held.open()
      }

      await expect(panel).toHaveAttribute('aria-busy', 'false')
      await expect(link).toBeVisible()
      await api.expectServed()
      errors.expectNone()
    }
    finally {
      held.open()
      await api.dispose()
    }
  })
}
