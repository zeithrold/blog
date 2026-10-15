import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function draftPreview(page: Page): Promise<Locator> {
  await page.locator('.workspace-header')
    .getByRole('button', { name: 'More document actions', exact: true })
    .click()
  const drawer = page.locator('.document-actions-drawer[role="dialog"]')
  const menu = page.locator('.document-action-menu[role="menu"]')
  await expect(drawer.or(menu)).toBeVisible()
  if (await drawer.isVisible()) {
    await expect(drawer).toHaveAccessibleName('More document actions')
    await drawer.getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(drawer).toHaveCount(0)
  }
  else {
    await menu.getByRole('menuitem', { name: 'Preview', exact: true }).click()
    await expect(menu).toHaveCount(0)
  }
  const preview = page.locator('.draft-preview-dialog[role="dialog"]')
  await expect(preview).toBeVisible()
  await expect(preview).toHaveAccessibleName('Draft preview')
  return preview
}
