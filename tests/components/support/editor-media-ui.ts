import type { Locator, Page } from '@playwright/test'
import type { Buffer } from 'node:buffer'
import type { ComponentMode } from '../src/contract'
import type { ApiCall, ApiHandler, ApiService } from './http-fixtures'
import type { GalleryAllocation, MediaLedger, PreviewReply } from './media-boundary'
import type { MediaAsset } from './media-fixtures'
import type { OpenDocument } from '@/contracts/documents'
import { expect } from '@playwright/test'
import { z } from 'zod'
import { saveSchema } from '@/contracts/documents'
import { editorWorkspaceSaveAck } from './editor-workspace-fixtures'
import { editorReady, mountEditorWorkspace } from './editor-workspace-ui'
import { mediaHandlers, mediaLedger, serveMediaPreviews } from './media-boundary'
import { assetFor } from './media-fixtures'

/**
 * The editor's media surfaces on the real workspace: the picker and the media
 * details panel. A case supplies its own document, its own listing and its own
 * writes; the HTTP wire for media comes from the shared media boundary, so a case
 * never has to describe an allocation, a transfer or a preview by hand.
 */
export const mediaCopy = {
  en: {
    add: 'Add media',
    dialog: 'Add media',
    details: 'Edit media',
    uploadTab: 'Upload files',
    libraryTab: 'Media library',
    detailsTab: 'Media details',
    upload: 'Upload files',
    close: 'Close',
    mediaFile: 'Media file',
    open: 'Open media',
    use: 'Use media',
    alt: 'Alternative text',
    transcript: 'Transcript',
    captions: 'Video captions',
    poster: 'Video poster',
    uploadCaptions: 'Upload captions',
    uploadPoster: 'Upload poster',
    saved: /^Saved$/,
  },
  zh: {
    add: '添加媒体',
    dialog: '添加媒体',
    details: '编辑媒体',
    uploadTab: '上传文件',
    libraryTab: '媒体库',
    detailsTab: '媒体详情',
    upload: '上传文件',
    close: '关闭',
    mediaFile: '媒体文件',
    open: '打开媒体',
    use: '使用此媒体',
    alt: '替代文本',
    transcript: '文字稿',
    captions: '视频字幕',
    poster: '视频封面',
    uploadCaptions: '上传字幕',
    uploadPoster: '上传封面',
    saved: /^已保存$/,
  },
} as const

export type MediaLocale = keyof typeof mediaCopy

export type EditorMedia = {
  readonly api: ApiService
  readonly ledger: MediaLedger
  /** Asset ids whose private bytes this case's route actually served. */
  readonly served: readonly string[]
}

/** Mounts the workspace with the private-bytes route, the media wire and an ack per save. */
export async function mountEditorMedia(page: Page, options: {
  document: OpenDocument
  width: number
  locale?: MediaLocale
  mode?: ComponentMode
  /** Answers the library listing; the default lists the allocations this case made. */
  listing?: (read: number) => readonly MediaAsset[] | Promise<readonly MediaAsset[]>
  /**
   * The private bytes a non-image asset serves, using what the case uploaded.
   * Leaving one out lets the API boundary report the read instead of answering it.
   */
  content?: (allocation: GalleryAllocation) => PreviewReply | undefined
  writes?: Readonly<Record<string, ApiHandler>>
}): Promise<EditorMedia> {
  const ledger = mediaLedger()
  const api = await mountEditorWorkspace(page, {
    document: options.document,
    width: options.width,
    locale: options.locale ?? 'en',
    mode: options.mode ?? 'light',
    writes: {
      ...mediaHandlers(ledger, {
        // The library tab lists what the server holds, so it reads back the very
        // allocations this case made; only the upload queue is client-side state.
        listing: options.listing
          ?? (() => ledger.allocations.map(entry => assetFor(entry.assetId, entry.request))),
      }),
      'PUT /api/admin/documents/:id/revisions': call => editorWorkspaceSaveAck(call),
      ...options.writes,
    },
  })
  // Registered after the case's API route so the private bytes answer first.
  const previews = await serveMediaPreviews(page, { ledger, content: options.content })
  await editorReady(page, options.locale ?? 'en')
  return { api, ledger, served: previews.served }
}

export async function openAddMedia(page: Page, locale: MediaLocale = 'en'): Promise<Locator> {
  await page.getByRole('button', { name: mediaCopy[locale].add, exact: true }).click()
  const dialog = page.getByRole('dialog', { name: mediaCopy[locale].dialog, exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

export async function uploadMediaFile(
  dialog: Locator,
  locale: MediaLocale,
  file: { name: string, mimeType: string, buffer: Buffer },
): Promise<void> {
  const text = mediaCopy[locale]
  await dialog.getByRole('tab', { name: text.uploadTab, exact: true }).click()
  await dialog.getByLabel(text.mediaFile, { exact: true }).setInputFiles(file)
  await dialog.getByRole('button', { name: text.upload, exact: true }).click()
  await expect(dialog.locator('.media-upload-item').filter({ hasText: file.name }))
    .toHaveAttribute('data-state', 'complete', { timeout: 15000 })
}

/** Opens the media details panel of the first media block in the body. */
export async function openMediaDetails(page: Page, locale: MediaLocale = 'en'): Promise<Locator> {
  await page.getByLabel('Document body', { exact: true }).locator('img').first().click()
  await page.getByRole('toolbar', { name: 'Editor actions', exact: true })
    .getByRole('button', { name: mediaCopy[locale].details, exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: mediaCopy[locale].details, exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

/** Chooses a listed asset for the block the details panel was opened for. */
export async function chooseLibraryMedia(dialog: Locator, locale: MediaLocale, filename: string): Promise<void> {
  const text = mediaCopy[locale]
  await dialog.getByRole('tab', { name: text.libraryTab, exact: true }).click()
  const card = dialog.locator('.editor-media-card').filter({ hasText: filename })
  await expect(card.locator('img')).toBeVisible()
  await card.getByRole('button', { name: text.use, exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

/** The bytes the video block, its caption track and its poster serve back. */
export function videoPreview(files: {
  clip: Buffer
  captions: Buffer
  poster: Buffer
}): (allocation: GalleryAllocation) => PreviewReply | undefined {
  const replies: Readonly<Record<string, PreviewReply>> = {
    'context-video.mp4': { contentType: 'video/mp4', body: files.clip },
    'context-captions.vtt': { contentType: 'text/vtt', body: files.captions },
    'context-poster.png': { contentType: 'image/png', body: files.poster },
  }
  return ({ request }: GalleryAllocation): PreviewReply | undefined => replies[request.filename]
}

/** Loads the block's real video element and reports its native media state. */
export async function loadedVideo(page: Page): Promise<{ readyState: number, error: number | null }> {
  const element = page.getByLabel('Document body', { exact: true }).locator('video').first()
  await expect(element).toBeAttached()
  return await element.evaluate(async (node) => {
    if (!(node instanceof HTMLVideoElement)) {
      throw new TypeError('The media block rendered no video element')
    }
    const video = node
    const code = (): number | null => (video.error === null ? null : video.error.code)
    const initial = code()
    if (initial !== null) {
      throw new TypeError(`The video element failed before loading: media error ${initial}`)
    }
    // Listen before asking for bytes, and resolve explicitly when metadata is
    // already there: a load that finished earlier fires no further event.
    let metadata = (): void => {}
    let failure = (_: unknown): void => {}
    const loaded = new Promise<void>((resolve, reject) => {
      metadata = resolve
      failure = reject
    })
    const arrived = (): void => {
      metadata()
    }
    const failed = (): void => {
      failure(new TypeError(`The video element failed to load: media error ${String(code())}`))
    }
    video.addEventListener('loadedmetadata', arrived, { once: true })
    video.addEventListener('error', failed, { once: true })
    if (video.readyState >= 1) {
      metadata()
    }
    else {
      // A media block need not fetch until it is asked to.
      video.load()
    }
    await loaded
    video.removeEventListener('loadedmetadata', arrived)
    video.removeEventListener('error', failed)
    return { readyState: video.readyState, error: code() }
  })
}

/** Fills the video's transcript, caption track and poster from uploaded assets. */
export async function describeVideo(
  page: Page,
  dialog: import('@playwright/test').Locator,
  files: { captions: Buffer, poster: Buffer },
): Promise<void> {
  await dialog.getByRole('tab', { name: 'Media details', exact: true }).click()
  // A video block has no decorative-image switch.
  await expect(dialog.getByLabel('Decorative image', { exact: true })).toHaveCount(0)
  await dialog.getByLabel('Transcript', { exact: true }).fill('A short black frame with a caption.')
  await dialog.getByRole('button', { name: 'Upload captions', exact: true }).click()
  await uploadMediaFile(dialog, 'en', {
    name: 'context-captions.vtt',
    mimeType: 'text/vtt',
    buffer: files.captions,
  })
  await dialog.getByRole('tab', { name: 'Media details', exact: true }).click()
  await dialog.getByRole('combobox', { name: 'Video captions', exact: true }).click()
  await page.getByRole('option', { name: 'context-captions.vtt', exact: true }).click()
  await dialog.getByRole('button', { name: 'Upload poster', exact: true }).click()
  await uploadMediaFile(dialog, 'en', {
    name: 'context-poster.png',
    mimeType: 'image/png',
    buffer: files.poster,
  })
  await dialog.getByRole('tab', { name: 'Media details', exact: true }).click()
  await dialog.getByRole('combobox', { name: 'Video poster', exact: true }).click()
  await page.getByRole('option', { name: 'context-poster.png', exact: true }).click()
}

const MEDIA_BLOCKS: readonly string[] = [
  'image',
  'video',
  'file',
]

/** The one media block the saved body carries, with the fields stored for it. */
export function storedMediaBlock(
  api: { readonly calls: readonly ApiCall[] },
): { id: string, fields: StoredFields | undefined } {
  const stored = storedBody(api)
  const media = stored.blocks.filter(block => MEDIA_BLOCKS.includes(block.type))
  // The captions and the poster belong to the media block, not to blocks of their own.
  expect(media).toHaveLength(1)
  const id = media[0]?.id ?? ''
  return { id, fields: stored.fields(id) }
}

/** The writes the surface attempted, so a case can assert what it stored. */
export function revisionWrites(api: { readonly calls: readonly ApiCall[] }): ApiCall[] {
  return api.calls.filter(call => call.method === 'PUT' && call.path.endsWith('/revisions'))
}

/**
 * The subset of a saved document a case asserts, read from the payload its own save
 * carried. The envelope is the product's save contract; the body is read defensively
 * because that contract deliberately leaves `document` opaque. This is a payload
 * assertion, never proof that a row was stored.
 */
const storedBodySchema = z.object({
  blocks: z.array(z.object({
    id: z.string(),
    type: z.string(),
    props: z.record(z.string(), z.unknown()).optional(),
  })),
  mediaAccessibility: z.record(z.string(), z.object({
    alt: z.string(),
    transcript: z.string(),
    captionAssetId: z.string().nullable(),
    posterAssetId: z.string().nullable(),
  })).default({}),
})

export type StoredBlock = { id: string, type: string, url: string, name: string }
export type StoredFields = {
  alt: string
  transcript: string
  captionAssetId: string | null
  posterAssetId: string | null
}
export type StoredBody = {
  /** Every block id, in body order, so a case can prove the block set survived. */
  blockIds: string[]
  blocks: StoredBlock[]
  /** The accessibility fields the saved body carries for one block. */
  fields: (blockId: string) => StoredFields | undefined
}

export function storedBody(api: { readonly calls: readonly ApiCall[] }): StoredBody {
  const write = revisionWrites(api).at(-1)
  if (write === undefined) {
    throw new Error('The case stored no revision body')
  }
  const body = storedBodySchema.parse(saveSchema.parse(write.json).document)
  return {
    blockIds: body.blocks.map(block => block.id),
    blocks: body.blocks.map(block => ({
      id: block.id,
      type: block.type,
      url: stringOf(block.props?.url),
      name: stringOf(block.props?.name),
    })),
    fields: blockId => body.mediaAccessibility[blockId],
  }
}

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
