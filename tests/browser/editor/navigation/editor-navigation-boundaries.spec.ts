import { openDocumentSchema } from '@/content/contracts'
import { writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { expect, test } from '~/tests/support/browser/test'

test('a sidebar navigation keeps the editor mounted until the latest draft is saved', async ({ page }) => {
  const original = await writeDocument(page, fixture('Navigation baseline'))
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let started = (): void => {}
  const saving = new Promise<void>((resolve) => {
    started = resolve
  })
  await page.route('**/revisions', async (route) => {
    started()
    await held
    await route.continue()
  })
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Last edit before navigating')
  await page.getByRole('link', { name: 'Tags', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
  await saving
  release()
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  const response = await page.request.get(`/api/admin/documents/${original.documentId}`)
  const saved = openDocumentSchema.parse(await response.json())
  expect(saved.document.meta.title).toBe('Last edit before navigating')
})
