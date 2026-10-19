import type { Page } from '@playwright/test'
import type { Document } from '@/content/document'
import { expect } from '@playwright/test'
import { acknowledgementSchema } from '@/contracts/documents'
import { sessionSchema } from '@/contracts/session'

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
  // Authenticate setup requests without a throwaway browser navigation through
  // the admin list. The first browser destination is the document under test.
  const login = await page.request.get('/__fixture/login', { maxRedirects: 0 })
  expect(login.status()).toBe(302)
  expect(login.headers().location).toBe('/admin')
  const session = sessionSchema.parse(
    await (await page.request.get('/api/admin/session')).json(),
  )
  const origin = new URL(login.url()).origin
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
