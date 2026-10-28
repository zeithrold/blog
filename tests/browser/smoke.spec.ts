import type { Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { acknowledgementSchema, openDocumentSchema } from '@/contracts/documents'
import { sessionSchema } from '@/contracts/session'

// Compare against the departing document, allowing native BFCache restoration.
const documentMarker = '__smokeDocument'

async function markDocument(page: Page): Promise<string> {
  const token = randomUUID()
  await page.evaluate(({ name, value }) => Reflect.set(window, name, value), { name: documentMarker, value: token })
  return token
}

async function navigatedInDocument(page: Page, previous: string): Promise<boolean> {
  return await page.evaluate(({ name, value }) => Reflect.get(window, name) !== value, {
    name: documentMarker,
    value: previous,
  })
}

async function dismissUnsavedBack(page: Page): Promise<void> {
  const asked = page.waitForEvent('dialog')
  // The dialog interrupts the evaluation; wait for it, not a cancelled goBack.
  void page.evaluate(() => history.back()).catch(() => undefined)
  const dialog = await asked
  expect(dialog.type()).toBe('beforeunload')
  await dialog.dismiss()
}

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

test('the editor is a document boundary and unsaved Back stays native', async ({ page }) => {
  const id = await createDocument(page)
  await page.reload()
  const path = `/admin/documents/${id}`
  const body = page.getByRole('textbox', { name: 'Document body', exact: true })
  const link = page.locator(`a[href="${path}"]`)
  await expect(link).toBeVisible()

  // Entering the editor loads a document instead of a client-side route.
  const listDocument = await markDocument(page)
  await link.click()
  await expect(page).toHaveURL(path)
  await expect(body).toBeVisible()
  expect(await navigatedInDocument(page, listDocument)).toBe(true)

  // Back and Forward stay real document navigations in both directions.
  const editorDocument = await markDocument(page)
  await page.goBack()
  await expect(page).toHaveURL('/admin')
  await expect(link).toBeVisible()
  expect(await navigatedInDocument(page, editorDocument)).toBe(true)

  const returnedListDocument = await markDocument(page)
  await page.goForward()
  await expect(page).toHaveURL(path)
  await expect(body).toBeVisible()
  expect(await navigatedInDocument(page, returnedListDocument)).toBe(true)

  // Unsaved work is protected by the browser's own confirmation, and dismissing
  // it keeps the editor document and its content.
  const text = `Unsaved ${randomUUID()}`
  await body.fill(text)
  await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'dirty')
  await dismissUnsavedBack(page)
  await expect(page).toHaveURL(path)
  await expect(body).toHaveText(text)

  // A real site-link click must use save/retry/stay, not the native Back policy.
  await page.route('**/api/admin/documents/*/revisions', async route => await route.abort())
  const pendingText = `Guarded departure ${randomUUID()}`
  await body.fill(pendingText)
  await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'dirty')
  const site = page.getByRole('link', { name: 'View site', exact: true })
  await site.click()
  const departure = page.getByRole('dialog', { name: 'Save before leaving', exact: true })
  await expect(departure).toBeVisible()
  await departure.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(departure).toBeHidden()
  await expect(page).toHaveURL(path)
  await expect(body).toHaveText(pendingText)

  await page.unroute('**/api/admin/documents/*/revisions')
  const departingDocument = await markDocument(page)
  await site.click()
  await expect(page).toHaveURL('/')
  expect(await navigatedInDocument(page, departingDocument)).toBe(true)
  const savedResponse = await page.request.get(`/api${path}`)
  expect(savedResponse.ok()).toBe(true)
  expect(JSON.stringify(openDocumentSchema.parse(await savedResponse.json()).document.blocks)).toContain(pendingText)

  // Returning to the editor must not retain a blanket permission to leave.
  await page.goBack()
  await expect(page).toHaveURL(path)
  await page.route('**/api/admin/documents/*/revisions', async route => await route.abort())
  await body.fill(`Explicit discard ${randomUUID()}`)
  await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'dirty')
  await dismissUnsavedBack(page)
  await expect(page).toHaveURL(path)
  await site.click()
  await expect(departure).toBeVisible()
  // Playwright dismisses unexpected native dialogs. If discard raised a second
  // confirmation, this navigation would stay on the editor and fail.
  await departure.getByRole('button', { name: 'Leave without saving', exact: true }).click()
  await expect(page).toHaveURL('/')
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
