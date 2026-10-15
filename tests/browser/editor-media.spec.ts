import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { openDocumentSchema } from '../../src/content/contracts'
import { saved } from './helpers'

async function queueDroppedImages(page: Page, bytes: number[]): Promise<void> {
  await page.getByRole('group', { name: 'Drop files here', exact: true }).evaluate((element, png) => {
    const files = new DataTransfer()
    for (const name of ['editor-first.png', 'editor-second.png']) {
      files.items.add(new File([
        new Uint8Array(png),
      ], name, { type: 'image/png' }))
    }
    element.dispatchEvent(new DragEvent('drop', { dataTransfer: files, bubbles: true, cancelable: true }))
  }, bytes)
}

async function holdUploads(page: Page): Promise<() => void> {
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/admin/assets/**', async (route) => {
    if (route.request().method() === 'PUT') {
      await gate
    }
    await route.continue()
  })
  return release
}

test('editor uploads preserve dropped files and lock media sources during upload', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/__fixture/login')
  await page.getByRole('button', { name: 'New post', exact: true }).click()
  const body = page.getByLabel('Document body', { exact: true })
  await body.fill('Ordered media anchor')
  await saved(page)
  const bytes = Array.from(await page.screenshot({ type: 'png' }))
  await page.getByRole('button', { name: 'Add media', exact: true }).click()
  const upload = page.getByRole('dialog', { name: 'Add media', exact: true })
  await expect(upload).toBeVisible()
  await queueDroppedImages(page, bytes)
  await expect(upload.locator('.media-upload-item')).toHaveCount(2)
  await upload.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Add media', exact: true }).click()
  await expect(upload.locator('.media-upload-item')).toHaveCount(2)
  const release = await holdUploads(page)
  await upload.getByRole('button', { name: 'Upload files', exact: true }).click()
  try {
    await expect(upload.locator('.media-upload-item').first()).toHaveAttribute('data-state', 'uploading')
    await expect(upload.getByRole('button', { name: 'Close', exact: true })).toBeDisabled()
    await expect(upload.getByRole('tab', { name: 'Media library', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Publish', exact: true, includeHidden: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(upload).toBeVisible()
  }
  finally {
    release()
  }
  await expect(upload.locator('.media-upload-item[data-state="complete"]')).toHaveCount(2, { timeout: 20000 })
  await upload.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(body.locator('img')).toHaveCount(2)
  await saved(page)
  const document = openDocumentSchema.parse(await (await page.request.get(
    new URL(page.url()).pathname.replace('/admin/documents/', '/api/admin/documents/'),
  )).json()).document
  expect(document.blocks.filter(block => block.type === 'image').map(block => block.props.name))
    .toEqual(['editor-first.png', 'editor-second.png'])
  await verifyLibraryInsertion(page)
})

async function verifyLibraryInsertion(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add media', exact: true }).click()
  await page.getByRole('tab', { name: 'Media library', exact: true }).click()
  const card = page.locator('.editor-media-card').filter({ hasText: 'editor-first.png' })
  await expect(card.locator('img')).toBeVisible()
  await expect(card.getByRole('link', { name: 'Open media', exact: true }))
    .toHaveAttribute('href', /\/api\/admin\/assets\/[^/]+\/content$/)
  await card.getByRole('button', { name: 'Use media', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Add media', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Document body', { exact: true }).locator('img')).toHaveCount(3)
}
