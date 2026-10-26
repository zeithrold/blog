import { historyCopy } from '~/tests/components/support/history-copy'
import { historyCase, historyReads } from '~/tests/components/support/history-fixtures'
import { chooseRevision, mountHistory } from '~/tests/components/support/history-surface'
import { serveApi } from '~/tests/components/support/http-fixtures'
import { expect, test } from '~/tests/components/support/test'
import { horizontalBounds } from '~/tests/support/browser/layout'

// The jsdom selection cases prove the missing reasons, the disabled publish and the
// removed block; only the rendered geometry still needs a browser.
for (const locale of ['en', 'zh'] as const) {
  test(`history explains unpublished revision requirements in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: locale === 'zh' ? 390 : 1440, height: 1000 })
    const copy = historyCopy[locale]
    const fixture = historyCase()
    const api = await serveApi(page, historyReads(fixture))
    try {
      await mountHistory(page, locale)
      await chooseRevision(page, copy, locale === 'zh', fixture.created.sequence)
      const reasons = page.locator('.history-publication-requirements')
      await expect(reasons).toBeVisible()
      await reasons.scrollIntoViewIfNeeded()
      await horizontalBounds(page, reasons)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
