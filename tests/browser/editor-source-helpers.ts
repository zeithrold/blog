import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function draftPreview(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'More document actions', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'More document actions', exact: true })
  const menu = page.getByRole('menu')
  await expect(drawer.or(menu)).toBeVisible()
  if (await drawer.isVisible()) {
    await drawer.getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(drawer).toHaveCount(0)
  }
  else {
    await menu.getByRole('menuitem', { name: 'Preview', exact: true }).click()
    await expect(menu).toHaveCount(0)
  }
  const preview = page.getByRole('dialog', { name: 'Draft preview', exact: true })
  await expect(preview).toBeVisible()
  return preview
}
