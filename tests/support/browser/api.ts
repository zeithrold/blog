import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { acknowledgementSchema } from '@/contracts/documents'
import { sessionSchema } from '@/contracts/session'

export async function mutate(page: Page, path: string, body: unknown, method = 'POST'):
Promise<ReturnType<typeof acknowledgementSchema.parse>> {
  // The origin comes from this request's own response, so a mutation does not
  // depend on the page having navigated anywhere yet: setup that seeds through the
  // API can delete what it just seeded before the browser opens the surface.
  const sessionResponse = await page.request.get('/api/admin/session')
  const session = sessionSchema.parse(await sessionResponse.json())
  const response = await page.request.fetch(path, {
    method,
    data: body,
    headers: {
      'origin': new URL(sessionResponse.url()).origin,
      'x-csrf-token': session.csrfToken,
      'idempotency-key': crypto.randomUUID(),
    },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return acknowledgementSchema.parse(await response.json())
}
