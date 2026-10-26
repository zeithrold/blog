import { labels } from '~/tests/support/browser/locale'
import { expect, test } from '~/tests/support/browser/test'
import { historyFixture } from './preview-history-helpers'

// The entry is a plain link to the stored revision's reader page: opening it serves
// the historical document from D1 through the real route in a new tab. The width and
// locale matrix, the comparison and the labels are component cases; this keeps the
// server-rendered historical reader.
test('the historical preview entry opens the stored revision in a new tab', async ({ page }) => {
  const { first } = await historyFixture(page)
  await page.goto(`/admin/documents/${first.documentId}/history`)
  await page.locator('.history-sidebar').getByRole('button', { name: /^Revision 2(?:\s|$)/ }).click()
  const [historical] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('link', { name: labels.en.historical, exact: true }).click(),
  ])
  await expect(historical.getByText('The historical paragraph before its edit', { exact: true })).toBeVisible()
  await expect(historical.getByText('The current paragraph after its edit', { exact: true })).toHaveCount(0)
  await historical.close()
})
