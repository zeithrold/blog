import type { Locator, Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { expect, test } from '~/tests/support/browser/test'

async function dropFiles(page: Page, png: number[], filenames: [string, string]): Promise<void> {
  await page.getByRole('group', { name: 'Drop files here', exact: true }).evaluate((element, { bytes, names }) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File([
      new Uint8Array(bytes),
    ], names[0], { type: 'image/png' }))
    transfer.items.add(new File(['Private gallery notes'], names[1], { type: 'text/plain' }))
    element.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }))
  }, { bytes: png, names: filenames })
}

async function expectUsableClose(dialog: Locator): Promise<void> {
  const close = dialog.getByRole('button', { name: 'Close', exact: true })
  await expect(close).toBeInViewport({ ratio: 1 })
  expect(await close.evaluate((button) => {
    const rect = button.getBoundingClientRect()
    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return target !== null && button.contains(target)
  })).toBe(true)
}

test('gallery accepts multi-file drops, protects active uploads and filters media', async ({ page }, info) => {
  await page.goto('/__fixture/login')
  await page.goto('/admin/media')
  const png = Array.from(await page.screenshot({ type: 'png' }))
  const trigger = page.getByRole('button', { name: 'Upload media', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
  await expect(dialog).toHaveClass(/media-upload-dialog/)
  const prefix = crypto.randomUUID()
  const imageName = `gallery-drop-${prefix}.png`
  const notesName = `gallery-notes-${prefix}.txt`
  await dropFiles(page, png, [imageName, notesName])
  await expect(dialog.getByRole('listitem')).toHaveCount(2)
  let release: (() => void) | undefined
  const hold = new Promise<void>((resolve) => {
    release = resolve
  })
  let uploads = 0
  await page.route('**/api/admin/assets/**', async (route) => {
    if (route.request().method() === 'PUT') {
      uploads++
      if (uploads === 1) {
        await hold
      }
    }
    await route.continue()
  })
  await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Uploading…', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect.poll(() => uploads).toBe(1)
  release?.()
  await expect(dialog.getByText('Upload complete.', { exact: true })).toHaveCount(2, { timeout: 15000 })
  expect(uploads).toBe(2)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(trigger).toBeFocused()
  const gallery = page.getByRole('list', { name: 'Gallery', exact: true })
  await expect(gallery.getByRole('listitem').filter({ hasText: imageName }).locator('img')).toHaveCount(1)
  await page.getByRole('searchbox', { name: 'Search loaded media' }).fill(notesName)
  await expect(gallery.getByRole('listitem')).toHaveCount(1)
  await expect(gallery).toContainText(notesName)
  await page.getByRole('combobox', { name: 'Media type', exact: true }).click()
  await page.getByRole('option', { name: 'image', exact: true }).click()
  await expect(page.getByText('No media matches', { exact: true })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search loaded media' }).fill(imageName)
  await expect(gallery.getByRole('listitem')).toHaveCount(1)
  await expect(gallery).toContainText(imageName)
  await page.getByRole('searchbox', { name: 'Search loaded media' }).fill('')
  await page.getByRole('combobox', { name: 'Media type', exact: true }).click()
  await page.getByRole('option', { name: 'All media', exact: true }).click()
  await expect(gallery.getByRole('heading', { name: notesName, exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('gallery-desktop.png'), fullPage: true })
})

test.describe('accessibility scanner', () => {
  test.use({ bypassCSP: true })
  test('upload dialogs and mobile drawers keep queued files, focus and keyboard access', async ({ page }, info) => {
    await page.goto('/__fixture/login')
    await page.goto('/admin/media')
    const trigger = page.getByRole('button', { name: 'Upload media', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
    await assertAccessible(page, info, { label: 'gallery-desktop-upload-dialog' })
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await page.setViewportSize({ width: 320, height: 740 })
    await trigger.click()
    await expect(dialog).toHaveClass(/media-upload-drawer/)
    const prefix = `queued-mobile-${crypto.randomUUID()}`
    const firstName = `${prefix}-0.txt`
    await page.getByLabel('Media file').setInputFiles(Array.from({ length: 6 }, (_, index) => ({
      name: `${prefix}-${index}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(`Private note ${index}`),
    })))
    await expect(dialog).toContainText(firstName)
    expect(await dialog.locator('.media-upload-drawer-body').evaluate(element =>
      element.scrollHeight > element.clientHeight)).toBe(true)
    await expectUsableClose(dialog)
    await assertAccessible(page, info, { label: 'gallery-mobile-upload-drawer' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('gallery-upload-mobile.png'), fullPage: true })
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(trigger).toBeFocused()
    await trigger.click()
    await expect(dialog).toContainText(firstName)
    await expectUsableClose(dialog)
    await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
    await expect(dialog).toContainText('Upload complete.', { timeout: 15000 })
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(page.locator('.media-card').filter({
      has: page.getByRole('heading', { name: firstName, exact: true }),
    })).toBeVisible()
  })
})
