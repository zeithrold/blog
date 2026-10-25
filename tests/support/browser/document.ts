import type { Page } from '@playwright/test'
import type { Document } from '@/content/document'
import { expect } from '@playwright/test'
import { acknowledgementSchema } from '@/contracts/documents'
import { sessionSchema } from '@/contracts/session'

// The list panel publishes its own busy state and renders the rows it loaded, so
// these are the signals that say the surface is usable. Waiting for network
// silence instead would also wait for traffic nobody is waiting on: sibling route
// prefetches and the remote font stylesheet.
export async function documentListReady(page: Page, title?: string): Promise<void> {
  await expect(page.locator('.document-list-panel')).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('.document-loading')).toHaveCount(0)
  if (title !== undefined) {
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible()
  }
}

// The filter form stays natively disabled until React owns the server markup, so
// an enabled search box proves the admin shell is hydrated. Anything that clicks
// a list control waits for this, not for the document request to answer.
export async function documentsHydrated(page: Page, search = 'Search by title'): Promise<void> {
  await expect(page.getByRole('searchbox', { name: search, exact: true })).toBeEnabled()
}

export async function saved(page: Page): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({
    timeout: 15000,
  })
  await expect(page.getByRole('alert')).toHaveCount(0)
}
// A document that exists and is stored is what a list, metadata or trash case
// needs: creating it and writing its revision are request-scoped, so nothing about
// those cases depends on the editor. Seeding stops there, and the browser opens the
// admin list the case actually asserts on as its first destination.
export async function seedDocument(
  page: Page,
  document: Document,
): Promise<ReturnType<typeof acknowledgementSchema.parse>> {
  // Authenticate setup requests without a throwaway browser navigation through
  // the admin list.
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
  return await write(
    `/api/admin/documents/${created.documentId}/revisions`,
    {
      expectedVersion: created.version,
      baseRevisionId: created.headRevisionId,
      reason: 'manual',
      document,
    },
    'PUT',
  )
}

// Opening the document is the contract of every case that then edits, reads
// history, previews or watches the editor hydrate, so it stays an explicit step
// rather than part of seeding.
export async function openEditor(page: Page, documentId: string): Promise<void> {
  await page.goto(`/admin/documents/${documentId}`)
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
}

export async function writeDocument(
  page: Page,
  document: Document,
): Promise<ReturnType<typeof acknowledgementSchema.parse>> {
  // The first browser destination is the document under test.
  const result = await seedDocument(page, document)
  await openEditor(page, result.documentId)
  return result
}
