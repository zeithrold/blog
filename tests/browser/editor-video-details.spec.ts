import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { assetListSchema } from '../../src/content/service-contracts'
import { editorDocument, uploadFile } from './editor-media-flow-helpers'
import { saved, writeDocument } from './helpers'
import { fixture } from './preview-history-helpers'

const description = 'video descriptions select uploaded captions and posters without inserting extra blocks'
test(description, async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await writeDocument(page, fixture('A video with captions and a poster'))
  await page.getByRole('button', { name: 'Add media', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add media', exact: true })
  await uploadFile(dialog, {
    name: 'context-video.mp4',
    mimeType: 'video/mp4',
    buffer: await readFile(new URL('./fixtures/media-context-video.mp4', import.meta.url)),
  })
  await dialog.getByRole('tab', { name: 'Media details', exact: true }).click()
  await expect(dialog.getByLabel('Decorative image', { exact: true })).toHaveCount(0)
  await dialog.getByLabel('Transcript', { exact: true }).fill('A short black frame with a caption.')
  await dialog.getByRole('button', { name: 'Upload captions', exact: true }).click()
  await uploadFile(dialog, {
    name: 'context-captions.vtt',
    mimeType: 'text/vtt',
    buffer: Buffer.from('WEBVTT\n\n00:00.000 --> 00:00.120\nA black frame\n'),
  })
  await dialog.getByRole('tab', { name: 'Media details', exact: true }).click()
  await dialog.getByRole('combobox', { name: 'Video captions', exact: true }).click()
  await page.getByRole('option', { name: 'context-captions.vtt', exact: true }).click()
  await dialog.getByRole('button', { name: 'Upload poster', exact: true }).click()
  await uploadFile(dialog, { name: 'context-poster.png', mimeType: 'image/png', buffer: await page.screenshot() })
  await dialog.getByRole('tab', { name: 'Media details', exact: true }).click()
  await dialog.getByRole('combobox', { name: 'Video poster', exact: true }).click()
  await page.getByRole('option', { name: 'context-poster.png', exact: true }).click()
  await page.screenshot({ path: info.outputPath('video-details.png') })
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await saved(page)
  const document = (await editorDocument(page)).document
  const video = document.blocks.find(block => block.type === 'video')
  const fields = document.mediaAccessibility[video?.id ?? '']
  const assets = assetListSchema.parse(await (await page.request.get('/api/admin/assets')).json()).items
  expect(document.blocks.filter(block => [
    'image',
    'video',
    'file',
  ].includes(block.type))).toHaveLength(1)
  expect(fields?.transcript).toBe('A short black frame with a caption.')
  expect(fields?.captionAssetId).toBe(assets.find(asset => asset.filename === 'context-captions.vtt')?.assetId)
  expect(fields?.posterAssetId).toBe(assets.find(asset => asset.filename === 'context-poster.png')?.assetId)
  expect(fields?.captionAssetId).not.toBeNull()
  expect(fields?.posterAssetId).not.toBeNull()
})
