import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function settingsTab(page: Page, name: 'Content' | 'Publication'): Promise<void> {
  await expect(page.locator('.inspector-drawer[data-state="closed"]')).toHaveCount(0)
  const trigger = page.getByRole('button', { name: 'Document settings', exact: true })
  if (await trigger.isVisible() && !(await page.getByRole('dialog').isVisible())) {
    await trigger.click()
  }
  await page.getByRole('tab', { name, exact: true }).click()
}
