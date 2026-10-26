import type { Locator, Page, TestInfo } from '@playwright/test'
import { documentEntry, selectDocuments } from '~/tests/components/support/domain-fixtures'
import { documentsCopy } from '~/tests/components/support/expected-copy'
import { defer, serveApi } from '~/tests/components/support/http-fixtures'
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

async function loadingLayout(page: Page, info: TestInfo, locale: 'en' | 'zh', width: number): Promise<void> {
  const entry = documentEntry({ title: `Loading layout ${crypto.randomUUID()}` })
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
    const loading = page.locator('.document-loading').getByRole('status')

    for (const refresh of [false, true]) {
      if (refresh) {
        held = defer()
        await page.getByRole('button', { name: copy.refresh, exact: true }).click()
      }
      await expectIndicatorSpacing(loading)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await assertAccessible(page, info, { label: `document-loading-${locale}-${String(refresh)}` })
      await page.screenshot({ path: info.outputPath(`document-loading-${locale}-${String(refresh)}.png`) })
      held.open()
      await api.expectServed()
    }
  }
  finally {
    held.open()
    await api.dispose()
  }
}

test('English first-load and refresh indicator geometry survives reduced motion at 1440px', async ({ page }, info) => {
  await loadingLayout(page, info, 'en', 1440)
})

test('Chinese first-load and refresh indicator geometry survives reduced motion at 320px', async ({ page }, info) => {
  await loadingLayout(page, info, 'zh', 320)
})
