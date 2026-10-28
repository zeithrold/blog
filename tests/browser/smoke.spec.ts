import type { Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { acknowledgementSchema, openDocumentSchema } from '@/contracts/documents'
import { sessionSchema } from '@/contracts/session'

// API preparation does not navigate or mount the editor.
async function createDocument(page: Page): Promise<string> {
  const session = await page.request.get('/api/admin/session')
  expect(session.ok()).toBe(true)
  const { csrfToken } = sessionSchema.parse(await session.json())
  const response = await page.request.post('/api/admin/documents', {
    headers: {
      'Origin': 'http://127.0.0.1:8800',
      'X-CSRF-Token': csrfToken,
      'Idempotency-Key': randomUUID(),
    },
    data: { kind: 'article' },
  })
  expect(response.status()).toBe(201)
  return acknowledgementSchema.parse(await response.json()).documentId
}

test.beforeEach(async ({ page }) => {
  await page.goto('/__fixture/login')
  await expect(page).toHaveURL('/admin')
  // Unlike New post, Refresh list is disabled in SSR until the client list loads.
  await expect(page.getByRole('button', { name: 'Refresh list', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'New post', exact: true })).toBeEnabled()
})

test('real editor saves Chinese text and reloads it', async ({ page }) => {
  await page.getByRole('button', { name: 'New post', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/documents\/[a-f0-9-]+$/)
  const path = new URL(page.url()).pathname
  const title = `Browser smoke ${randomUUID()}`
  const text = '真实浏览器保存中文正文。'
  const body = page.getByRole('textbox', { name: 'Document body', exact: true })
  await expect(body).toBeVisible()
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title)
  await body.fill(text)
  await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'saved')

  // Server read-back prevents IndexedDB recovery from disguising a failed save.
  const response = await page.request.get(`/api${path}`)
  expect(response.ok()).toBe(true)
  const saved = openDocumentSchema.parse(await response.json())
  expect(saved.document.meta.title).toBe(title)
  expect(JSON.stringify(saved.document.blocks)).toContain(text)

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(title)
  await expect(body).toHaveText(text)
})

test('list navigation supports native Back and Forward', async ({ page }) => {
  const id = await createDocument(page)
  await page.reload()
  const path = `/admin/documents/${id}`
  const link = page.locator(`a[href="${path}"]`)
  await expect(link).toBeVisible()
  await link.click()
  await expect(page).toHaveURL(path)
  await expect(page.getByRole('textbox', { name: 'Document body', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL('/admin')
  await expect(link).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(path)
  await expect(page.getByRole('textbox', { name: 'Document body', exact: true })).toBeVisible()
})

test('narrow settings supports keyboard activation and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const id = await createDocument(page)
  await page.goto(`/admin/documents/${id}`)
  await expect(page.getByRole('textbox', { name: 'Document body', exact: true })).toBeVisible()
  const trigger = page.getByRole('button', { name: 'Document settings', exact: true })
  await expect(trigger).toBeInViewport({ ratio: 1 })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Document settings', exact: true })
  await expect(dialog).toBeVisible()
  const publication = dialog.getByRole('tab', { name: 'Publication', exact: true })
  await publication.focus()
  await page.keyboard.press('Enter')
  await expect(publication).toHaveAttribute('aria-selected', 'true')
  await expect(publication).toBeInViewport({ ratio: 1 })
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})
