import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { historySchema, openDocumentSchema } from '../../src/content/contracts'
import { historyFixture, mutate } from './history-helpers'

test('history compares stable blocks, restores a new head and publishes a selected historical revision', async ({
  page,
}) => {
  const { path, first, latest, slug } = await historyFixture(page)
  await page.getByRole('button', { name: /^Revision 2 / }).click()
  const baseline = page.getByRole('combobox', { name: 'Compare against', exact: true })
  await baseline.click()
  await page.getByRole('option', { name: /^Revision 2 / }).click()
  await expect(page.getByText('These revisions contain the same content.', { exact: true })).toBeVisible()
  await baseline.click()
  await page.getByRole('option', { name: /^Revision 3 / }).click()
  const changed = page.locator('.diff-row[data-change="changed"]')
  await expect(changed).toHaveCount(1)
  await changed.locator('.diff-block-trigger').click()
  await expect(changed.getByText('First historical body', { exact: true })).toBeVisible()
  await expect(changed.getByText('Latest draft body', { exact: true })).toBeVisible()
  const restore = page.getByRole('button', { name: 'Restore as new draft', exact: true })
  await restore.click()
  await page.keyboard.press('Escape')
  await expect(restore).toBeFocused()
  await restore.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Created a new draft revision' })).toBeVisible()
  const restored = openDocumentSchema.parse(await (await page.request.get(path)).json())
  expect(restored.headRevisionId).not.toBe(first.headRevisionId)
  expect(restored.headRevisionId).not.toBe(latest.headRevisionId)
  expect(restored.liveRevisionId).toBe(first.headRevisionId)
  expect(restored.document.meta.title).toBe('First historical title')
  await page.getByRole('button', { name: /^Revision 3 / }).click()
  await page.getByRole('button', { name: 'Publish selected revision', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('The previous public URL will stop working')
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Published the selected revision' })).toBeVisible()
  const published = openDocumentSchema.parse(await (await page.request.get(path)).json())
  expect(published.headRevisionId).toBe(restored.headRevisionId)
  expect(published.liveRevisionId).toBe(latest.headRevisionId)
  expect((await page.request.get(`/posts/${slug}`)).status()).toBe(404)
  expect(await (await page.request.get(`/posts/${slug}-updated`)).text()).toContain('Latest draft body')
})
test('history CAS conflict refreshes the baseline and preserves the selected revision for explicit retry', async ({
  page,
}) => {
  const { path, first, latest } = await historyFixture(page)
  await page.getByRole('button', { name: /^Revision 2 / }).click()
  const external = openDocumentSchema.parse(await (await page.request.get(path)).json())
  external.document.meta.title = 'Another tab changed the draft'
  const saved = await mutate(page, `${path}/revisions`, {
    expectedVersion: latest.version,
    baseRevisionId: latest.headRevisionId,
    reason: 'manual',
    document: external.document,
  }, 'PUT')
  await page.getByRole('button', { name: 'Restore as new draft', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Another tab changed this document' })).toBeVisible()
  await expect(page.locator('.history-selection')).toHaveAttribute('data-selected-revision', first.headRevisionId)
  await verifyBaseline(page, path, saved.headRevisionId)
  const current = openDocumentSchema.parse(await (await page.request.get(path)).json())
  expect(current.headRevisionId).toBe(saved.headRevisionId)
  expect(current.liveRevisionId).toBe(first.headRevisionId)
})

async function verifyBaseline(page: Page, path: string, revisionId: string): Promise<void> {
  const history = historySchema.parse(await (await page.request.get(`${path}/revisions`)).json())
  const revision = history.items.find(item => item.revisionId === revisionId)
  expect(revision).toBeDefined()
  if (revision === undefined) {
    throw new Error('Expected baseline revision in saved history')
  }
  const selection = page.getByRole('combobox', { name: 'Compare against', exact: true })
  await expect(selection).toContainText(`Revision ${revision.sequence}`)
  await expect(selection).toContainText('Current draft')
  await selection.click()
  await expect(page.getByRole('option', { name: new RegExp(`^Revision ${revision.sequence} .*Current draft$`) }))
    .toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Escape')
  await expect(selection).toBeFocused()
}
