import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function publicationTime(page: Page, value: string): Promise<void> {
  const [date = '', time = ''] = value.split('T')
  const [year = '', month = '', day = ''] = date.split('-')
  await page.getByRole('button', { name: 'Publication date', exact: true }).click()
  await page.getByRole('combobox', { name: 'Choose year', exact: true }).click()
  await page.getByRole('option', { name: year, exact: true }).click()
  await page.getByRole('combobox', { name: 'Choose month', exact: true }).click()
  await page.getByRole('option').nth(Number(month) - 1).click()
  await page.locator('.app-calendar .rdp-day-button').filter({ hasText: new RegExp(`^${Number(day)}$`) }).click()
  await page.getByLabel('Publication time', { exact: true }).fill(time)
}

export async function verifiedTime(page: Page): Promise<string> {
  await page.getByRole('combobox', { name: 'Verified UTC time', exact: true }).click()
  await expect(page.getByRole('option')).toHaveCount(2)
  const choice = page.getByRole('option').nth(1)
  const label = await choice.innerText()
  await choice.click()
  return label
}

export async function chooseTimezone(page: Page, timezone: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Publication timezone', exact: true }).click()
  await page.getByRole('combobox', { name: 'Search cities or timezones', exact: true }).fill(timezone)
  await page.getByRole('option', { name: new RegExp(`${timezone}$`) }).click()
}
