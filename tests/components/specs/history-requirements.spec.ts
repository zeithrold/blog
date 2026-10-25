import { historyCopy } from '~/tests/components/support/history-copy'
import { historyCase, historyReads } from '~/tests/components/support/history-fixtures'
import { chooseRevision, mountHistory } from '~/tests/components/support/history-surface'
import { serveApi } from '~/tests/components/support/http-fixtures'
import { expect, test } from '~/tests/components/support/test'
import { horizontalBounds } from '~/tests/support/browser/layout'

for (const locale of ['en', 'zh'] as const) {
  test(`history explains unpublished revision requirements in ${locale}`, async ({ page }, info) => {
    await page.setViewportSize({ width: locale === 'zh' ? 390 : 1440, height: 1000 })
    const copy = historyCopy[locale]
    const fixture = historyCase()
    const api = await serveApi(page, historyReads(fixture))
    try {
      await mountHistory(page, locale)
      await chooseRevision(page, copy, locale === 'zh', fixture.created.sequence)
      const reasons = page.locator('.history-publication-requirements')
      await expect(reasons.getByRole('listitem')).toHaveText(copy.requirements)
      await expect(page.getByRole('button', { name: copy.publish, exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: copy.restore, exact: true })).toBeEnabled()
      await reasons.scrollIntoViewIfNeeded()
      await horizontalBounds(page, reasons)
      await page.screenshot({ path: info.outputPath(`history-requirements-${locale}.png`) })
      await chooseRevision(page, copy, locale === 'zh', fixture.latest.sequence)
      await expect(reasons).toHaveCount(0)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
