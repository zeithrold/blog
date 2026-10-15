import type { Locator, Page } from '@playwright/test'
import type { Locale } from './preview-history-helpers'
import { expect } from '@playwright/test'
import { linkCopy, openKeyboardLink } from './link-keyboard-helpers'

export async function openLinkEntry(page: Page, width: number, locale: Locale, entry: 'keyboard' | 'toolbar'):
Promise<Locator> {
  if (entry === 'keyboard') {
    return await openKeyboardLink(page, locale, 'Meta')
  }
  if (width <= 700) {
    await page.getByRole('button', {
      name: locale === 'en' ? 'More formatting options' : '更多格式选项',
      exact: true,
    }).click()
    await page.getByRole('dialog', { name: linkCopy[locale].more, exact: true })
      .getByRole('button', { name: linkCopy[locale].dialog, exact: true })
      .click()
    await expect(page.locator('.formatting-options-drawer')).toHaveCount(0)
  }
  else {
    await page.getByRole('toolbar', { name: 'Formatting', exact: true })
      .getByRole('button', { name: linkCopy[locale].dialog, exact: true })
      .click()
  }
  const dialog = page.getByRole('dialog', { name: linkCopy[locale].dialog, exact: true })
  await expect(dialog).toBeVisible()
  const url = dialog.getByRole('textbox', { name: linkCopy[locale].url, exact: true })
  await expect(url).toBeFocused()
  return url
}
