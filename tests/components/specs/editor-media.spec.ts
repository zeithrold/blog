import type { Page } from '@playwright/test'
import type { ApiCall, ApiService } from '~/tests/components/support/http-fixtures'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import {
  loadedVideo,
  mountEditorMedia,
  openAddMedia,
  openMediaDetails,
  revisionWrites,
  storedBody,
  storedMediaBlock,
  videoPreview,
} from '~/tests/components/support/editor-media-ui'
import { editorWorkspaceDocument } from '~/tests/components/support/editor-workspace-fixtures'
import { expect, test } from '~/tests/components/support/test'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { settingsTab } from '~/tests/support/browser/settings'

/**
 * The editor's media selection, replacement and description controls on the real
 * workspace surface. A case asserts the payload its own save carried - block ids,
 * media URLs and accessibility fields - never a stored row: R2, private routing
 * and reload persistence stay with the Worker and the retained browser case.
 */
async function settled(page: Page): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 15000 })
}

async function savedWrite(api: { readonly calls: readonly ApiCall[] }, before: number): Promise<void> {
  await expect.poll(() => revisionWrites(api).length, { timeout: 15000 }).toBeGreaterThan(before)
}

async function uploadEditorMediaFile(
  dialog: import('@playwright/test').Locator,
  api: ApiService,
  file: { name: string, mimeType: string, buffer: Buffer },
): Promise<void> {
  await dialog.getByRole('tab', { name: 'Upload files', exact: true }).click()
  await dialog.getByLabel('Media file', { exact: true }).setInputFiles(file)
  await dialog.getByRole('button', { name: 'Upload files', exact: true }).click()
  await api.expectServed()
}

/** Uploads one file through the add-media picker and waits for the save it triggers. */
async function insertMedia(
  page: Page,
  api: ApiService,
  file: { name: string, mimeType: string, buffer: Buffer },
): Promise<void> {
  const add = await openAddMedia(page)
  await uploadEditorMediaFile(add, api, file)
  await add.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(add).toHaveCount(0)
  await settled(page)
}

/** Chooses a listed file for the block whose details panel is open. */
async function reuseListed(page: Page, api: { readonly calls: readonly ApiCall[] }, name: string): Promise<void> {
  const reuse = await openMediaDetails(page)
  const before = revisionWrites(api).length
  await reuse.getByRole('tab', { name: 'Media library', exact: true }).click()
  const card = reuse.locator('.editor-media-card').filter({ hasText: name })
  await card.getByRole('button', { name: 'Use media', exact: true }).click()
  await savedWrite(api, before)
  await settled(page)
}

async function chooseListedMedia(dialog: import('@playwright/test').Locator, name: string): Promise<void> {
  await dialog.getByRole('tab', { name: 'Media library', exact: true }).click()
  const card = dialog.locator('.editor-media-card').filter({ hasText: name })
  await card.getByRole('button', { name: 'Use media', exact: true }).click()
}

async function describeVideoInEditor(
  page: Page,
  dialog: import('@playwright/test').Locator,
  files: { captions: Buffer, poster: Buffer },
  api: ApiService,
): Promise<void> {
  await dialog.getByRole('tab', { name: 'Media details', exact: true }).click()
  await dialog.getByLabel('Transcript', { exact: true }).fill('A short black frame with a caption.')
  await dialog.getByRole('button', { name: 'Upload captions', exact: true }).click()
  await uploadEditorMediaFile(dialog, api, {
    name: 'context-captions.vtt',
    mimeType: 'text/vtt',
    buffer: files.captions,
  })
  await dialog.getByRole('tab', { name: 'Media details', exact: true }).click()
  await dialog.getByRole('combobox', { name: 'Video captions', exact: true }).click()
  await page.getByRole('option', { name: 'context-captions.vtt', exact: true }).click()
  await dialog.getByRole('button', { name: 'Upload poster', exact: true }).click()
  await uploadEditorMediaFile(dialog, api, {
    name: 'context-poster.png',
    mimeType: 'image/png',
    buffer: files.poster,
  })
  await dialog.getByRole('tab', { name: 'Media details', exact: true }).click()
  await dialog.getByRole('combobox', { name: 'Video poster', exact: true }).click()
  await page.getByRole('option', { name: 'context-poster.png', exact: true }).click()
}

for (const width of [390, 1440]) {
  test(`media replacement preserves the block and descriptions at ${width}px`, async ({ page }, info) => {
    const { api } = await mountEditorMedia(page, {
      document: editorWorkspaceDocument(`Media placement anchor ${width}`),
      width,
    })
    try {
      const prefix = `${width}-${crypto.randomUUID()}`
      const originalName = `original-${prefix}.png`
      await insertMedia(page, api, {
        name: originalName,
        mimeType: 'image/png',
        buffer: await page.screenshot(),
      })

      const inserted = storedBody(api)
      const [image] = inserted.blocks.filter(block => block.type === 'image')
      if (image === undefined) {
        throw new Error('The first upload stored no image block')
      }
      const originalUrl = image.url

      // The description value belongs to the block that receives the replacement.
      const edit = await openMediaDetails(page)
      await edit.getByLabel('Alternative text', { exact: true }).fill('Description belongs to this block')
      const beforeReplace = revisionWrites(api).length
      await uploadEditorMediaFile(edit, api, {
        name: `replacement-${prefix}.png`,
        mimeType: 'image/png',
        buffer: await page.screenshot(),
      })
      await edit.getByRole('button', { name: 'Close', exact: true }).click()
      await savedWrite(api, beforeReplace)
      await settled(page)

      // The replacement kept the block: same ids, still one image, description intact.
      const replaced = storedBody(api)
      const replacedImages = replaced.blocks.filter(block => block.type === 'image')
      expect(replaced.blockIds).toEqual(inserted.blockIds)
      expect(replacedImages).toHaveLength(1)
      expect(replaced.fields(image.id)?.alt).toBe('Description belongs to this block')
      expect(replacedImages[0]?.url).not.toBe(originalUrl)

      // Choosing the original file again reuses it and keeps the description.
      await reuseListed(page, api, originalName)
      const reused = storedBody(api)
      expect(reused.blockIds).toEqual(inserted.blockIds)
      expect(reused.blocks.filter(block => block.type === 'image')[0]?.url).toBe(originalUrl)
      expect(reused.fields(image.id)?.alt).toBe('Description belongs to this block')

      const details = await openMediaDetails(page)
      await expect(details.getByLabel('Alternative text', { exact: true }))
        .toHaveValue('Description belongs to this block')
      await assertAccessible(page, info, { label: `media-details-${width}` })
      await page.screenshot({ path: info.outputPath('media-block-details.png') })
      await details.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(details).toHaveCount(0)
      await settingsTab(page, 'Content')
      await expect(page.getByRole('tab', { name: 'Media', exact: true })).toHaveCount(0)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })

  test(`slash image opens media sources and fills its original placeholder at ${width}px`, async ({ page }) => {
    const open = editorWorkspaceDocument(`Slash image ${width}`)
    const placeholder = open.document.blocks[0]?.id ?? ''
    const { api } = await mountEditorMedia(page, { document: open, width })
    try {
      const name = `slash-image-${width}-${crypto.randomUUID()}.png`
      const body = page.getByLabel('Document body', { exact: true })
      await body.focus()
      await page.keyboard.type('/image')
      await expect(page.getByRole('option', { name: /^Image / })).toBeVisible()
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('dialog', { name: 'Add media', exact: true })
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      // The placeholder keeps its own picker control until a file fills it.
      await body.locator('.bn-add-file-button').click()
      await expect(dialog).toBeVisible()
      await uploadEditorMediaFile(dialog, api, {
        name,
        mimeType: 'image/png',
        buffer: await page.screenshot(),
      })
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      await settled(page)

      const stored = storedBody(api)
      const images = stored.blocks.filter(block => block.type === 'image')
      expect(images).toHaveLength(1)
      // The placeholder paragraph became the image block; nothing was appended.
      expect(images[0]?.id).toBe(placeholder)
      expect(images[0]?.url).toMatch(/^\/assets\//)
      await expect(body.locator('.bn-add-file-button')).toHaveCount(0)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

for (const source of ['upload', 'library'] as const) {
  test(`consecutive ${source} replacements keep the same media block within one editing window`, async ({ page }) => {
    const { api } = await mountEditorMedia(page, {
      document: editorWorkspaceDocument(`Consecutive ${source} replacements`),
      width: 1440,
    })
    try {
      const fileName = `original-${crypto.randomUUID()}.png`
      const png = await page.screenshot()
      const add = await openAddMedia(page)
      await uploadEditorMediaFile(add, api, { name: fileName, mimeType: 'image/png', buffer: png })
      await add.getByRole('button', { name: 'Close', exact: true }).click()
      await settled(page)

      const before = storedBody(api)
      const [first] = before.blocks.filter(block => block.type === 'image')
      if (first === undefined) {
        throw new Error('The first upload stored no image block')
      }
      const originalUrl = first.url

      const edit = await openMediaDetails(page)
      await edit.getByLabel('Alternative text', { exact: true }).fill('Keep the block description')
      await uploadEditorMediaFile(edit, api, {
        name: `first-replacement-${crypto.randomUUID()}.png`,
        mimeType: 'image/png',
        buffer: png,
      })
      const finalName = source === 'upload' ? `second-replacement-${crypto.randomUUID()}.png` : fileName
      if (source === 'upload') {
        await uploadEditorMediaFile(edit, api, { name: finalName, mimeType: 'image/png', buffer: png })
        await edit.getByRole('button', { name: 'Close', exact: true }).click()
      }
      else {
        await chooseListedMedia(edit, fileName)
      }
      await settled(page)

      const after = storedBody(api)
      const images = after.blocks.filter(block => block.type === 'image')
      expect(after.blockIds).toEqual(before.blockIds)
      expect(images).toHaveLength(1)
      expect(images[0]?.name).toBe(finalName)
      expect(images[0]?.url === originalUrl).toBe(source === 'library')
      expect(after.fields(first.id)?.alt).toBe('Keep the block description')
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test(
  'video descriptions select uploaded captions and posters without inserting extra blocks',
  async ({ page }, info) => {
    // The registered clip's real bytes travel the upload boundary and are the same
    // bytes its content path serves back, so the video element decodes what it wrote.
    const clip = await readFile(new URL('../../browser/fixtures/media-context-video.mp4', import.meta.url))
    const captions = Buffer.from('WEBVTT\n\n00:00.000 --> 00:00.120\nA black frame\n')
    const poster = await page.screenshot()
    const { api, ledger, served } = await mountEditorMedia(page, {
      document: editorWorkspaceDocument('A video with captions and a poster'),
      width: 390,
      content: videoPreview({ clip, captions, poster }),
    })
    try {
      const dialog = await openAddMedia(page)
      await uploadEditorMediaFile(dialog, api, { name: 'context-video.mp4', mimeType: 'video/mp4', buffer: clip })
      await describeVideoInEditor(page, dialog, { captions, poster }, api)
      await page.screenshot({ path: info.outputPath('video-details.png') })
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await settled(page)

      const { fields } = storedMediaBlock(api)
      expect(fields?.transcript).toBe('A short black frame with a caption.')
      const captionAsset = ledger.allocations.find(entry => entry.request.filename === 'context-captions.vtt')
      const posterAsset = ledger.allocations.find(entry => entry.request.filename === 'context-poster.png')
      expect(fields?.captionAssetId).toBe(captionAsset?.assetId)
      expect(fields?.posterAssetId).toBe(posterAsset?.assetId)
      expect(fields?.captionAssetId).not.toBeNull()
      expect(fields?.posterAssetId).not.toBeNull()

      // The block's element reads its bytes from the content path this case serves.
      const playback = await loadedVideo(page)
      // Code 4 is MEDIA_ERR_SRC_NOT_SUPPORTED: a failed load leaves `error` set, so
      // metadata at readyState >= 1 with no error means the served bytes decoded.
      expect(playback.error).toBeNull()
      expect(playback.readyState).toBeGreaterThanOrEqual(1)
      const videoAsset = ledger.allocations.find(entry => entry.request.filename === 'context-video.mp4')
      expect(served).toContain(videoAsset?.assetId)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  },
)
