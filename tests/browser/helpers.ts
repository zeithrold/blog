import type { Page } from '@playwright/test'
import type { Document } from '../../src/content/document'
import { expect } from '@playwright/test'
import { acknowledgementSchema, sessionSchema } from '../../src/content/contracts'

export async function saved(page: Page): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 15000,
  })
  await expect(page.getByRole('alert')).toHaveCount(0)
}
export async function writeDocument(
  page: Page,
  document: Document,
): Promise<ReturnType<typeof acknowledgementSchema.parse>> {
  await page.goto('/__fixture/login')
  // Finish the admin page's initial prefetches before the fixture hard-navigates to its new document.
  await page.waitForLoadState('networkidle')
  const session = sessionSchema.parse(
    await (await page.request.get('/api/admin/session')).json(),
  )
  const origin = new URL(page.url()).origin
  const write = async (
    path: string,
    body: unknown,
    method = 'POST',
  ): Promise<ReturnType<typeof acknowledgementSchema.parse>> => {
    const response = await page.request.fetch(path, {
      method,
      data: body,
      headers: {
        origin,
        'x-csrf-token': session.csrfToken,
        'idempotency-key': crypto.randomUUID(),
      },
    })
    expect(response.ok(), await response.text()).toBe(true)
    return acknowledgementSchema.parse(await response.json())
  }
  const created = await write('/api/admin/documents', {})
  const result = await write(
    `/api/admin/documents/${created.documentId}/revisions`,
    {
      expectedVersion: created.version,
      baseRevisionId: created.headRevisionId,
      reason: 'manual',
      document,
    },
    'PUT',
  )
  await page.goto(`/admin/documents/${created.documentId}`)
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
  return result
}

export async function settingsTab(page: Page, name: 'Content' | 'Publication'): Promise<void> {
  await expect(page.locator('.inspector-drawer[data-state="closed"]')).toHaveCount(0)
  const trigger = page.getByRole('button', { name: 'Document settings', exact: true })
  if (await trigger.isVisible() && !(await page.getByRole('dialog').isVisible())) {
    await trigger.click()
  }
  await page.getByRole('tab', { name, exact: true }).click()
}

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
