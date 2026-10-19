import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { catalogItemSchema } from '@/contracts/catalog'
import { sessionSchema } from '@/contracts/session'

export type Kind = 'tag' | 'series'
export type Entry = ReturnType<typeof catalogItemSchema.parse>

export async function writeCatalog(page: Page, kind: Kind, input: {
  name: string
  slug: string
  retired?: boolean
  expectedVersion?: number
}, id?: string): Promise<Entry> {
  const session = sessionSchema.parse(await (await page.request.get('/api/admin/session')).json())
  const response = await page.request.fetch(`/api/admin/catalog/${kind}${id === undefined ? '' : `/${id}`}`, {
    method: id === undefined ? 'POST' : 'PUT',
    data: input,
    headers: {
      'origin': new URL(page.url()).origin,
      'x-csrf-token': session.csrfToken,
      'idempotency-key': crypto.randomUUID(),
    },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return catalogItemSchema.parse(await response.json())
}

export async function fixture(page: Page, kind: Kind): Promise<{ first: Entry, second: Entry, path: string }> {
  await page.goto('/__fixture/login')
  const unique = crypto.randomUUID()
  const first = await writeCatalog(page, kind, { name: `Boundary A ${unique}`, slug: `boundary-a-${unique}` })
  const second = await writeCatalog(page, kind, { name: `Boundary B ${unique}`, slug: `boundary-b-${unique}` })
  await page.goto(`/admin/${kind === 'tag' ? 'tags' : 'series'}`)
  await expect(page.getByRole('button', { name: `Edit ${first.name}`, exact: true })).toBeVisible()
  return { first, second, path: `/api/admin/catalog/${kind}` }
}
