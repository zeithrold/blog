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
