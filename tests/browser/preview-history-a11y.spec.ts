import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { assertAccessible } from './accessibility'
import { settingsTab } from './helpers'
import { historyFixture, setRecovery } from './preview-history-helpers'

async function selectHistorical(page: Page, width: number): Promise<void> {
  if (width <= 700) {
    await page.getByRole('combobox', { name: 'Selected revision', exact: true }).click()
    await page.getByRole('option', { name: /^Revision 2(?:\s|$)/ }).click()
  }
  else {
    await page.locator('.history-sidebar').getByRole('button', { name: /^Revision 2(?:\s|$)/ }).click()
  }
  const changed = page.locator('.diff-row[data-change="changed"]')
  await expect(changed).toHaveCount(1)
  await changed.locator('.diff-block-trigger').click()
  await expect(changed.locator('[data-side="after"]')).toContainText('The historical paragraph before its edit')
}

test.describe('accessibility scanner', () => {
  // Axe creates its own style iframe; application behavior runs separately under its real CSP.
  test.use({ bypassCSP: true })
  for (const width of [390, 1440]) {
    test(`draft preview, recovery, history and confirmation are accessible at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 })
      const { first, latest } = await historyFixture(page)
      await settingsTab(page, 'Content')
      await page.getByRole('button', { name: 'Preview', exact: true }).click()
      const preview = page.getByRole('dialog', { name: 'Draft preview', exact: true })
      await expect(preview.getByRole('region', { name: 'Draft reader preview', exact: true }))
        .toContainText('The current paragraph after its edit')
      await assertAccessible(page, info, { label: `draft-preview-${width}` })
      await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
      if (width < 1100) {
        await page.getByRole('dialog', { name: 'Document settings', exact: true })
          .getByRole('button', { name: 'Close', exact: true })
          .click()
      }
      await setRecovery(page, latest)
      await page.reload()
      const recovery = page.getByRole('region', { name: 'Local recovery copy', exact: true })
      await expect(recovery).toBeVisible()
      await assertAccessible(page, info, { label: `recovery-${width}` })
      await recovery.getByRole('button', { name: 'Dismiss', exact: true }).click()
      await page.goto(`/admin/documents/${first.documentId}/history`)
      await selectHistorical(page, width)
      await assertAccessible(page, info, { label: `history-comparison-${width}` })
      await page.getByRole('button', { name: 'Restore as new draft', exact: true }).click()
      const confirmation = page.getByRole('dialog')
      await expect(confirmation).toBeVisible()
      await assertAccessible(page, info, { label: `history-confirmation-${width}` })
      await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
    })
  }
})
