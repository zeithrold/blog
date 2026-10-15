import type { Locator, Page } from '@playwright/test'
import type { Buffer } from 'node:buffer'
import { expect } from '@playwright/test'
import { openDocumentSchema } from '../../src/content/contracts'
import { withinViewport } from './block-action-helpers'

type FilePayload = { name: string, mimeType: string, buffer: Buffer }
type Document = ReturnType<typeof openDocumentSchema.parse>['document']

export function firstImage(document: Document): Document['blocks'][number] {
  const image = document.blocks.find(block => block.type === 'image')
  if (image === undefined) {
    throw new Error('The document has no image block')
  }
  return image
}

export async function editorDocument(page: Page): Promise<ReturnType<typeof openDocumentSchema.parse>> {
  const path = new URL(page.url()).pathname.replace('/admin/documents/', '/api/admin/documents/')
  return openDocumentSchema.parse(await (await page.request.get(path)).json())
}

export async function uploadFile(dialog: Locator, file: FilePayload): Promise<void> {
  await dialog.getByRole('tab', { name: 'Upload files', exact: true }).click()
  await dialog.getByLabel('Media file', { exact: true }).setInputFiles(file)
  await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
  await expect(dialog.locator('.media-upload-item').filter({ hasText: file.name }))
    .toHaveAttribute('data-state', 'complete', { timeout: 15000 })
}

export async function editFirstImage(page: Page, fromMenu = false): Promise<Locator> {
  const image = page.getByLabel('Document body', { exact: true }).locator('img').first()
  await image.click()
  if (fromMenu) {
    await image.evaluate(element => element.scrollIntoView({ block: 'center' }))
    await page.mouse.move(1, 1)
    await page.getByLabel('Document body', { exact: true }).locator('[data-content-type="image"]').first().hover()
    await expect(page.locator('.editor-side')).toHaveAttribute('data-block-type', 'image')
    const compact = (page.viewportSize()?.width ?? 0) <= 700
    if (compact) {
      await expect(page.getByRole('button', { name: 'Open block menu', exact: true }))
        .toHaveAttribute('data-block-id', await page.locator('.editor-side').getAttribute('data-block-id') ?? '')
    }
    await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
    if (compact) {
      await expect(page.getByRole('dialog', { name: 'Block actions', exact: true })).toBeVisible()
    }
    await page.locator('.editor-block-action-list').getByRole('button', { name: 'Edit media', exact: true }).click()
  }
  else {
    await page.getByRole('toolbar', { name: 'Editor actions', exact: true })
      .getByRole('button', { name: 'Edit media', exact: true })
      .click()
  }
  const dialog = page.getByRole('dialog', { name: 'Edit media', exact: true })
  await expect(dialog).toBeVisible()
  await withinViewport(page, dialog)
  await expect.poll(async () => await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
  return dialog
}

export async function chooseImage(dialog: Locator, filename: string): Promise<void> {
  await dialog.getByRole('tab', { name: 'Media library', exact: true }).click()
  const card = dialog.locator('.editor-media-card').filter({ hasText: filename })
  await expect(card.locator('img')).toBeVisible()
  await card.getByRole('button', { name: 'Use media', exact: true }).click()
  await expect(dialog).toHaveCount(0)
}
