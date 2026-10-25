import type { Page } from '@playwright/test'
import type { HistoryCopy } from './history-copy'
import { historyCopy } from './history-copy'
import { mountSurface } from './mount'
import { expect } from './test'

/** Mount the real history page against the case's HTTP table. */
export async function mountHistory(page: Page, locale: 'en' | 'zh' = 'en'): Promise<void> {
  await mountSurface(page, { surface: 'history-page', locale })
  await expect(page.getByRole('heading', { name: historyCopy[locale].title, level: 1 })).toBeVisible()
}

/** The sidebar selects a revision at 1440px; the selection Select replaces it at 390px. */
export async function chooseRevision(
  page: Page,
  copy: HistoryCopy,
  mobile: boolean,
  sequence: number,
): Promise<void> {
  if (mobile) {
    await page.getByRole('combobox', { name: copy.selected, exact: true }).click()
    await page.getByRole('option', { name: `${copy.revision} ${sequence}` }).click()
    return
  }
  await page.getByRole('button', { name: new RegExp(`^${copy.revision} ${sequence} `) }).click()
}

/** The confirmation dialog is the only path from a selection to a history write. */
export async function confirmAction(
  page: Page,
  copy: HistoryCopy,
  action: 'restore' | 'publish',
): Promise<void> {
  await page.getByRole('button', { name: action === 'restore' ? copy.restore : copy.publish, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: copy.confirm, exact: true }).click()
}

/** A refused refresh keeps the confirmed action visible but locks every control. */
export async function expectRefreshRequired(page: Page, copy: HistoryCopy, notice: string): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: notice })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText(copy.refreshRequired)
  await expect(page.getByRole('button', { name: copy.restore, exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: copy.publish, exact: true })).toBeDisabled()
  await expect(page.getByRole('combobox', { name: copy.compare, exact: true })).toBeDisabled()
}

/** Refresh history clears the alert and unlocks what the stale state locked. */
export async function expectRefreshRecovers(page: Page, copy: HistoryCopy): Promise<void> {
  await page.getByRole('button', { name: copy.refresh, exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: copy.compare, exact: true })).toBeEnabled()
}
