import type { Page } from '@playwright/test'
import { assetListSchema } from '@/contracts/media'
import { saved } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'
import { editFirstImage } from './editor-media-flow-helpers'

test('uploaded images use private previews, publish gates and accessible unpublish/delete confirmations', async ({
  page,
}, info) => {
  await page.goto('/__fixture/login')
  await page.getByRole('button', { name: 'New post' }).click()
  await page.getByLabel('Title', { exact: true }).fill('Media browser post')
  await page.getByLabel('Slug', { exact: true }).fill('media-browser')
  await page.getByLabel('Document body', { exact: true }).fill('Media body')
  const png = await page.screenshot({ type: 'png' })
  await page.getByRole('button', { name: 'Add media', exact: true }).click()
  await page
    .getByLabel('Media file', { exact: true })
    .setInputFiles({ name: 'native-preview.png', mimeType: 'image/png', buffer: png })
  await page.getByRole('button', { name: 'Upload files', exact: true }).click()
  await expect(page.locator('.media-upload-item').filter({ hasText: 'native-preview.png' }))
    .toHaveAttribute('data-state', 'complete', { timeout: 15000 })
  await page.getByRole('dialog', { name: 'Add media', exact: true })
    .getByRole('button', { name: 'Close', exact: true })
    .click()
  const assets = assetListSchema.parse(
    await (await page.request.get('/api/admin/assets')).json(),
  )
  const asset = assets.items.find(item => item.filename === 'native-preview.png')
  expect(asset).toBeDefined()
  await expect(page.locator('.bn-editor img')).toBeVisible()
  expect(
    await page
      .locator('.bn-editor img')
      .evaluate((element: HTMLImageElement) => element.naturalWidth),
  ).toBeGreaterThan(0)
  expect((await page.request.get(asset?.url ?? '')).status()).toBe(404)
  const edit = await editFirstImage(page)
  await edit.getByLabel('Alternative text', { exact: true }).fill('Browser screenshot')
  await edit.getByRole('button', { name: 'Close', exact: true }).click()
  await saved(page)
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  expect((await page.request.get(asset?.url ?? '')).status()).toBe(200)
  await page.getByRole('button', { name: 'More document actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Unpublish', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'More document actions', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'More document actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Unpublish', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Draft', { exact: true })).toBeVisible()
  await assertPrivate(page, asset?.url ?? '', asset?.sha256 ?? '')
  await page.screenshot({ path: info.outputPath('private-media-editor.png') })
  await page.getByRole('button', { name: 'More document actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Delete document', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Media browser post', exact: true }),
  ).toHaveCount(0)
})

async function assertPrivate(page: Page, url: string, sha256: string): Promise<void> {
  const asset = { url, sha256 }
  for (const method of ['GET', 'HEAD']) {
    expect(
      (
        await page.request.fetch(asset.url, {
          method,
          headers: { 'range': 'bytes=0-3', 'if-none-match': `"${asset.sha256}"` },
        })
      ).status(),
    ).toBe(404)
  }
}
