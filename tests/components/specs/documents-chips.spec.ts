import type { Locator, Page, TestInfo } from '@playwright/test'
import { documentEntry, selectDocuments } from '~/tests/components/support/domain-fixtures'
import { documentsCopy } from '~/tests/components/support/expected-copy'
import { serveApi } from '~/tests/components/support/http-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'
import { horizontalBounds } from '~/tests/support/browser/layout'

// The long text run stresses the real 320px chip width and painted remove icon.
async function longSearchChip(
  page: Page,
  info: TestInfo,
  locale: 'en' | 'zh',
  query: string,
): Promise<void> {
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
    await page.getByRole('button', { name: copy.submit, exact: true }).click()

    const chip = page.getByRole('list', { name: copy.activeFilters, exact: true }).getByRole('button')
    await horizontalBounds(page, chip)
    const text: Locator = chip.locator('span')
    expect(await text.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
    await expect(text).toHaveCSS('text-overflow', 'ellipsis')
    const icon = chip.locator('svg')
    await expect(icon).toBeVisible()
    await horizontalBounds(page, icon)
    const iconBounds = await icon.evaluate((element) => {
      const iconBox = element.getBoundingClientRect()
      const chipBox = element.closest('button')?.getBoundingClientRect()
      if (chipBox === undefined) {
        throw new Error('The remove icon is not inside a chip')
      }
      return {
        iconLeft: iconBox.left,
        iconRight: iconBox.right,
        chipLeft: chipBox.left,
        chipRight: chipBox.right,
      }
    })
    expect(iconBounds.iconLeft).toBeGreaterThanOrEqual(iconBounds.chipLeft)
    expect(iconBounds.iconRight).toBeLessThanOrEqual(iconBounds.chipRight)
    await page.screenshot({ path: info.outputPath(`long-search-${locale}-320.png`) })

    await chip.click()
    await expect(search).toBeFocused()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
}

test('120-character en search chip ellipsizes and returns native focus at 320px', async ({ page }, info) => {
  await longSearchChip(page, info, 'en', 'W'.repeat(120))
})

test('120-character zh search chip ellipsizes and returns native focus at 320px', async ({ page }, info) => {
  await longSearchChip(page, info, 'zh', '文'.repeat(120))
})
