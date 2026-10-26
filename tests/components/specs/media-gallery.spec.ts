import type { Locator, Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { serveGallery } from '~/tests/components/support/media-boundary'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'
import { assertAccessible } from '~/tests/support/browser/accessibility'

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

/** The close control stays reachable, not merely rendered inside the drawer. */
async function expectUsableClose(dialog: Locator): Promise<void> {
  const close = dialog.getByRole('button', { name: 'Close', exact: true })
  await expect(close).toBeInViewport({ ratio: 1 })
  expect(await close.evaluate((button) => {
    const rect = button.getBoundingClientRect()
    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return target !== null && button.contains(target)
  })).toBe(true)
}

// The gallery is the media page's own client surface, so a case mounts it exactly
// as that page does and describes only the responses it would have read. The
// title is the retained historical registration identity, not a claim about
// current scope: this case now proves the real DataTransfer delivery and the
// queued rows, while the active-upload guard and the filters are proved against
// the same surface in jsdom. The wider title is known naming debt.
test('gallery accepts multi-file drops, protects active uploads and filters media', async ({ page }) => {
  const gallery = await serveGallery(page)
  try {
    await mountSurface(page, { surface: 'media-gallery' })
    const trigger = page.getByRole('button', { name: 'Upload media', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
    const png = Array.from(await page.screenshot({ type: 'png' }))
    const prefix = crypto.randomUUID()
    const imageName = `gallery-drop-${prefix}.png`
    const notesName = `gallery-notes-${prefix}.txt`
    await dropFiles(page, png, [imageName, notesName])
    await expect(dialog.getByRole('listitem')).toHaveCount(2)
    await expect(dialog).toContainText(imageName)
    await expect(dialog).toContainText(notesName)
    await gallery.api.expectServed()
  }
  finally {
    await gallery.api.dispose()
  }
})

test.describe('accessibility scanner', () => {
  test.use({ bypassCSP: true })
  test('upload dialog and mobile drawer keep queued files, focus and keyboard access', async ({ page }, info) => {
    const gallery = await serveGallery(page)
    try {
      await mountSurface(page, { surface: 'media-gallery' })
      const trigger = page.getByRole('button', { name: 'Upload media', exact: true })
      await trigger.click()
      const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
      await assertAccessible(page, info, { label: 'gallery-desktop-upload-dialog' })
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()

      await page.setViewportSize({ width: 320, height: 740 })
      await trigger.click()
      await expect(dialog).toHaveClass(/media-upload-drawer/)
      const prefix = `queued-mobile-${crypto.randomUUID()}`
      await page.getByLabel('Media file').setInputFiles(Array.from({ length: 6 }, (_, index) => ({
        name: `${prefix}-${index}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from(`Private note ${index}`),
      })))
      expect(await dialog.locator('.media-upload-drawer-body').evaluate(element =>
        element.scrollHeight > element.clientHeight)).toBe(true)
      await expectUsableClose(dialog)
      await assertAccessible(page, info, { label: 'gallery-mobile-upload-drawer' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath('gallery-upload-mobile.png'), fullPage: true })

      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(trigger).toBeFocused()
      await gallery.api.expectServed()
    }
    finally {
      await gallery.api.dispose()
    }
  })
})
