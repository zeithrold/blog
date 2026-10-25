import { openDocumentSchema } from '@/contracts/documents'
import { expect, test } from '~/tests/support/browser/test'
import { expectCaptionTarget, locateTable, publicationTables, saveCaption } from './publication-locate-helpers'

test('unpublishing preserves the unresolved draft rejection and its locator', async ({ page }) => {
  const original = await publicationTables(page, 'en', true)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('link', { name: 'View live document', exact: true })).toBeVisible()
  await page.locator(`[data-id="${original.first}"] .editor-table-caption button`).scrollIntoViewIfNeeded()
  await saveCaption(page, original.first, '', 'en')
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Update publication', exact: true }).click()
  const notice = page.getByRole('region', { name: 'Publication checks failed', exact: true })
  await expect(locateTable(notice, 1)).toBeVisible()
  await page.getByRole('button', { name: 'More document actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Unpublish', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Unpublish this document?', exact: true })
  await confirm.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('link', { name: 'View live document', exact: true })).toHaveCount(0)
  await expect(locateTable(notice, 1)).toBeVisible()
  await locateTable(notice, 1).click()
  await expectCaptionTarget(page, original.first)
  const current = openDocumentSchema.parse(
    await (await page.request.get(`/api/admin/documents/${original.initial.documentId}`)).json(),
  )
  expect(current.liveRevisionId).toBeNull()
  expect(current.document.tableAccessibility[original.first]?.caption).toBe('')
  expect((await page.request.get(`/posts/${original.document.meta.slug}`)).status()).toBe(404)
})
