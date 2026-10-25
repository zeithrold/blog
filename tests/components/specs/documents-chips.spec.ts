import type { Locator } from '@playwright/test'
import { documentEntry, selectDocuments } from '~/tests/components/support/domain-fixtures'
import { documentsCopy } from '~/tests/components/support/expected-copy'
import { serveApi } from '~/tests/components/support/http-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'
import { horizontalBounds } from '~/tests/support/browser/layout'

// The search field accepts 120 characters, so the chip that reports the active
// search has to keep the control usable at the narrowest supported width.
for (const [locale, query] of [
  [
    'en',
    'W'.repeat(120),
  ],
  [
    'zh',
    '文'.repeat(120),
  ],
] as const) {
  test(`120-character ${locale} search chips fit at 320px and can be removed`, async ({ page }, info) => {
    const api = await serveApi(page, {
      'GET /api/admin/documents': call => selectDocuments([
        documentEntry({ title: `Chip row ${crypto.randomUUID()}` }),
      ], call),
    })
    try {
      await page.setViewportSize({ width: 320, height: 900 })
      await mountSurface(page, { surface: 'documents', locale })
      const copy = documentsCopy[locale]
      const search = page.getByRole('searchbox', { name: copy.search, exact: true })
      await search.fill(query)
      await expect(search).toHaveValue(query)
      await page.getByRole('button', { name: copy.submit, exact: true }).click()

      const chip = page.getByRole('list', { name: copy.activeFilters, exact: true }).getByRole('button')
      await expect(chip).toHaveAccessibleName(`${copy.removeFilter}: ${copy.search}: ${query}`)
      await horizontalBounds(page, chip)
      const text: Locator = chip.locator('span')
      expect(await text.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
      await expect(text).toHaveCSS('text-overflow', 'ellipsis')
      const icon = chip.locator('svg')
      await expect(icon).toBeVisible()
      await horizontalBounds(page, icon)
      await page.screenshot({ path: info.outputPath(`long-search-${locale}-320.png`) })

      await chip.click()
      await expect(chip).toHaveCount(0)
      await expect(search).toHaveValue('')
      await expect(search).toBeFocused()
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
