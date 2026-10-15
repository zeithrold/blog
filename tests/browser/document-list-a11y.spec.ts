import { expect, test } from '@playwright/test'
import { assertAccessible } from './accessibility'
import { labels, trashFixture } from './document-list-boundary-helpers'

test.describe('accessibility scanner', () => {
  test.use({ bypassCSP: true })
  for (const [locale, width] of [
    ['en', 1440],
    ['zh', 320],
  ] as const) {
    test(`restoration and refresh notices are accessible in ${locale} at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 })
      const { row } = await trashFixture(page, locale)
      const copy = labels[locale]
      if (locale === 'zh') {
        await page.getByRole('button', { name: '外观', exact: true }).click()
        await page.getByRole('menuitemradio', { name: '深色', exact: true }).click()
      }
      await page.route('**/api/admin/documents?*', async route => await route.fulfill({
        status: 503,
        json: { code: 'UNAVAILABLE' },
      }))
      await row.getByRole('button', { name: copy.restore, exact: true }).click()
      await expect(page.getByRole('alert')).toContainText(copy.error)
      await expect(page.getByRole('status').filter({ hasText: copy.restored })).toBeVisible()
      await assertAccessible(page, info, { label: `trash-notices-${locale}-${width}` })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath(`trash-notices-${locale}-${width}.png`) })
    })
  }
})
