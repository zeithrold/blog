import { Buffer } from 'node:buffer'
import { saved } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'
import { historyDocument, historyEditor } from './editor-history-helpers'

for (const cancel of [false, true]) {
  test(`immediate paste upload handles history ${cancel ? 'cancellation' : 'departure'}`, async ({
    page,
  }) => {
    const original = await historyEditor(page, 'back')
    const bytes = Array.from(await page.screenshot({ type: 'png' }))
    let release = (): void => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/api/admin/assets/*/content', async (route) => {
      if (route.request().method() === 'PUT') {
        await held
      }
      await route.continue()
    })
    const protectedImmediately = await page.getByLabel('Document body', { exact: true }).evaluate((element, input) => {
      const clipboardData = new DataTransfer()
      clipboardData.items.add(new File([
        new Uint8Array(input),
      ], 'history-paste.png', { type: 'image/png' }))
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
      const unload = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(unload)
      history.back()
      return unload.defaultPrevented
    }, bytes)
    expect(protectedImmediately).toBe(true)
    const dialog = page.getByRole('dialog', { name: 'Saving before leaving', exact: true })
    await expect(dialog).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
    if (cancel) {
      await dialog.getByRole('button', { name: 'Stay here', exact: true }).click()
    }
    release()
    if (cancel) {
      await expect(page.locator('.bn-editor img')).toHaveCount(1)
      await saved(page)
      await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
    }
    else {
      await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
    }
    const document = (await historyDocument(page, original.documentId)).document
    const media = document.blocks.filter(block => block.type === 'image')
    expect(media).toHaveLength(1)
    expect(media[0]?.props).toMatchObject({ name: 'history-paste.png', url: expect.stringMatching(/^\/assets\//) })
    expect(document.mediaAccessibility[media[0]?.id ?? '']).toBeDefined()
    expect(await page.evaluate(() => history.length)).toBe(original.length)
  })
}

test('a queued file blocks browser traversal and remains available after staying', async ({ page }) => {
  const original = await historyEditor(page, 'back')
  await page.getByRole('button', { name: 'Add media', exact: true }).click()
  const media = page.getByRole('dialog', { name: 'Add media', exact: true })
  await media.getByRole('tab', { name: 'Upload files', exact: true }).click()
  await media.getByLabel('Media file', { exact: true }).setInputFiles({
    name: 'keep-history.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Keep this queued file'),
  })
  await media.getByRole('button', { name: 'Close', exact: true }).click()
  await page.evaluate(() => history.back())
  const dialog = page.getByRole('dialog', { name: 'Save before leaving', exact: true })
  await expect(dialog.getByRole('alert')).toContainText('Finish or remove the queued uploads before leaving.')
  await dialog.getByRole('button', { name: 'Stay here', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/documents/${original.documentId}$`))
  await page.getByRole('button', { name: 'Add media', exact: true }).click()
  await media.getByRole('tab', { name: 'Upload files', exact: true }).click()
  await expect(media.locator('.media-upload-item')).toContainText('keep-history.txt')
  expect(await page.evaluate(() => history.length)).toBe(original.length)
})
