import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { acknowledgementSchema } from '@/contracts/documents'
import { sessionSchema } from '@/contracts/session'

export async function mutate(page: Page, path: string, body: unknown, method = 'POST'):
Promise<ReturnType<typeof acknowledgementSchema.parse>> {
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  const response = await page.request.fetch(path, {
    method,
    data: body,
    headers: {
      'origin': new URL(page.url()).origin,
      'x-csrf-token': session.csrfToken,
      'idempotency-key': crypto.randomUUID(),
    },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return acknowledgementSchema.parse(await response.json())
}
