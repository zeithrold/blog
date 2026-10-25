import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

// The catalog list keeps its Refresh control natively disabled until React owns the server
// markup and the first listing has settled, so an enabled control proves the admin shell is
// interactive. Entering the gallery before that is a plain anchor navigation: it loads a second
// document, and then the Back and Forward entries a gallery case traverses never shared the
// document whose in-memory upload queue it asserts on.
async function catalogReady(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
}

// The gallery trigger only exists once the entry check has opened a session, and stays disabled
// until the first listing settles: an enabled trigger is the gallery's own readiness signal.
export async function galleryReady(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Upload media', exact: true })).toBeEnabled()
}

// Entering through the shell link keeps both admin pages in one document, so a Back and Forward
// traversal returns to this gallery session instead of loading a fresh one.
export async function enterGallery(page: Page): Promise<void> {
  await page.goto('/__fixture/login')
  await page.goto('/admin/tags')
  await catalogReady(page)
  await page.getByRole('link', { name: 'Media library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible()
  await galleryReady(page)
  await page.getByRole('button', { name: 'Upload media', exact: true }).click()
}
