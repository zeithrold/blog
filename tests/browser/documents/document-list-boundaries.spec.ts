import { acknowledgementSchema, openDocumentSchema } from '@/contracts/documents'
import { expect, test } from '~/tests/support/browser/test'
import { trashFixture } from './document-list-boundary-helpers'

test('trash retries a lost restoration response without restoring twice', async ({ page }) => {
  const { target, row } = await trashFixture(page)
  const keys: string[] = []
  await page.route(`**/api/admin/documents/${target.documentId}/restore-deleted`, async (route) => {
    keys.push(route.request().headers()['idempotency-key'] ?? '')
    if (keys.length === 1) {
      expect((await route.fetch()).ok()).toBe(true)
      await route.abort('failed')
    }
    else {
      await route.continue()
    }
  })
  await row.getByRole('button', { name: 'Restore draft', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The restoration result could not be confirmed.')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(row).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Document restored as a draft' })).toBeFocused()
  expect(keys).toHaveLength(2)
  expect(keys[0]).not.toBe('')
  expect(keys[1]).toBe(keys[0])
  const response = await page.request.get(`/api/admin/documents/${target.documentId}`)
  const current = openDocumentSchema.parse(await response.json())
  expect(current.version).toBe(target.version + 1)
})

test('creating after a lost response opens the single confirmed document on retry', async ({ page }) => {
  await page.goto('/__fixture/login')
  let documentId = ''
  const keys: string[] = []
  await page.route('**/api/admin/documents', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    keys.push(route.request().headers()['idempotency-key'] ?? '')
    if (keys.length === 1) {
      const response = await route.fetch()
      documentId = acknowledgementSchema.parse(await response.json()).documentId
      await route.abort('failed')
    }
    else {
      await route.continue()
    }
  })
  await page.getByRole('button', { name: 'New post', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The creation result could not be confirmed.')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${documentId}$`))
  await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
  expect(keys).toHaveLength(2)
  expect(keys[1]).toBe(keys[0])
})
