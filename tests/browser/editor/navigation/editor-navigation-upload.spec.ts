import { openDocumentSchema } from '@/contracts/documents'
import { writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { expect, test } from '~/tests/support/browser/test'

test('sidebar departure waits for a pasted file and saves the resulting media block', async ({ page }) => {
  const original = await writeDocument(page, fixture('Upload before leaving'))
  const bytes = Array.from(await page.screenshot({ type: 'png' }))
  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let started = (): void => {}
  const uploading = new Promise<void>((resolve) => {
    started = resolve
  })
  await page.route('**/api/admin/assets/*/content', async (route) => {
    if (route.request().method() === 'PUT') {
      started()
      await held
    }
    await route.continue()
  })
  await page.getByLabel('Document body', { exact: true }).evaluate((element, input) => {
    const clipboardData = new DataTransfer()
    clipboardData.items.add(new File([
      new Uint8Array(input),
    ], 'leaving.png', { type: 'image/png' }))
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
  }, bytes)
  await uploading
  await page.getByRole('link', { name: 'Tags', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
  release()
  await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible()
  const current = openDocumentSchema.parse(await (await page.request.get(
    `/api/admin/documents/${original.documentId}`,
  )).json())
  const image = current.document.blocks.find(block => block.type === 'image')
  expect(image?.props).toMatchObject({ name: 'leaving.png', url: expect.stringMatching(/^\/assets\//) })
  expect(current.document.mediaAccessibility[image?.id ?? '']).toBeDefined()
})

test('save failure reports unavailable local recovery without discarding the current editor', async ({ page }) => {
  const original = await writeDocument(page, fixture('Unavailable recovery'))
  await page.evaluate(() => {
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value: () => { throw new DOMException('Storage unavailable', 'SecurityError') },
    })
  })
  await page.route('**/revisions', async route => await route.fulfill({
    status: 503,
    json: { code: 'CONNECTION_FAILED' },
  }))
  const title = page.getByRole('textbox', { name: 'Title', exact: true })
  await title.fill('Still in the editor')
  await page.getByRole('link', { name: 'Tags', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Save before leaving', exact: true })
  await expect(dialog.getByRole('alert')).toContainText(
    'Local recovery is unavailable. Leaving now may lose your changes.',
  )
  await expect(dialog.getByRole('alert')).not.toContainText('A local draft copy has been saved')
  await dialog.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(title).toHaveValue('Still in the editor')
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
})
