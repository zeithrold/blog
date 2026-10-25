import { Buffer } from 'node:buffer'
import { defer } from '~/tests/components/support/http-fixtures'
import { serveGallery } from '~/tests/components/support/media-boundary'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'

/**
 * The gallery keeps what it uploaded, but only a read the case controls decides
 * what the server holds. These cases mount the real manager and let the boundary
 * hold or replay a listing read, which is what the E2E cases spent a whole routed
 * Worker on.
 */
test('a delayed gallery refresh keeps an upload completed while it was reading', async ({ page }) => {
  const hold = defer()
  const captured = defer()
  const gallery = await serveGallery(page, {
    listing: async (read) => {
      // Every read sees the empty server list; the first one answers at once.
      if (read > 1) {
        captured.open()
        await hold.promise
      }
      return []
    },
  })
  try {
    await mountSurface(page, { surface: 'media-gallery' })
    const trigger = page.getByRole('button', { name: 'Upload media', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
    const name = `listing-race-${crypto.randomUUID()}.txt`
    await page.getByLabel('Media file').setInputFiles({
      name,
      mimeType: 'text/plain',
      buffer: Buffer.from('Confirmed upload'),
    })
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()

    const refresh = page.getByRole('button', { name: 'Refresh', exact: true })
    await refresh.click()
    await captured.promise
    // The read is open; the queue now finishes inside that window.
    await trigger.click()
    await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
    await expect(dialog.getByRole('listitem').filter({ hasText: name })).toHaveAttribute('data-state', 'complete')
    hold.open()
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(refresh).toBeEnabled()
    const list = page.getByRole('list', { name: 'Gallery', exact: true })
    await expect(list.getByRole('heading', { name, exact: true })).toBeVisible()
    await gallery.api.expectServed()
  }
  finally {
    hold.open()
    captured.open()
    await gallery.api.dispose()
  }
})

test('a later authoritative gallery refresh removes a card absent from the server listing', async ({ page }) => {
  const gallery = await serveGallery(page, { listing: () => [] })
  try {
    await mountSurface(page, { surface: 'media-gallery' })
    const trigger = page.getByRole('button', { name: 'Upload media', exact: true })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Upload media', exact: true })
    const name = `listing-authoritative-${crypto.randomUUID()}.txt`
    await page.getByLabel('Media file').setInputFiles({
      name,
      mimeType: 'text/plain',
      buffer: Buffer.from('Accepted upload'),
    })
    await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
    await expect(dialog.getByRole('listitem').filter({ hasText: name })).toHaveAttribute('data-state', 'complete')
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()

    const list = page.getByRole('list', { name: 'Gallery', exact: true })
    await expect(list.getByRole('heading', { name, exact: true })).toBeVisible()
    // The accepted card was never in a server listing, so the next read wins.
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByText('No media yet', { exact: true })).toBeVisible()
    await expect(list.getByRole('heading', { name, exact: true })).toHaveCount(0)
    await gallery.api.expectServed()
  }
  finally {
    await gallery.api.dispose()
  }
})
