import type { MountedGallery } from './media-support'
import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { all, button, click, combobox, field, openCombobox, option, press, typeText } from './dom'
import { setMediaState, until } from './environment'
import { defer } from './http'
import {
  mediaAsset,
  mediaFile,
  mediaGalleryHandlers,
  mountMediaGallery,
  resetMediaDom,
  selectFiles,
} from './media-support'

afterEach(resetMediaDom)

const imageId = '21111111-1111-4111-8111-111111111111'
const fileId = '22222222-2222-4222-8222-222222222222'

async function waitForGallery(view: MountedGallery): Promise<void> {
  await act(async () => {
    await until(() => view.session.snapshot().loaded)
  })
}

function openUploadDialog(view: MountedGallery): HTMLElement {
  act(() => click(button(view.container, 'Upload media')))
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
  if (dialog === null) {
    throw new Error('The upload dialog did not open')
  }
  return dialog
}

function mediaFileInput(root: ParentNode): HTMLInputElement {
  const input = field(root, 'Media file')
  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('The media file control is not an input')
  }
  return input
}

async function expectCompleteUploads(dialog: HTMLElement, count: number): Promise<void> {
  await act(async () => {
    await until(() => all(dialog, '.media-upload-item[data-state="complete"]').length === count)
  })
  expect(all(dialog, '.media-upload-item[data-state="complete"]')).toHaveLength(count)
}

async function exerciseMediaFilters(
  view: MountedGallery,
  dialog: HTMLElement,
  image: string,
  notes: string,
): Promise<void> {
  act(() => click(button(dialog, 'Close')))
  const search = field(view.container, 'Search loaded media')
  typeText(search, notes)
  act(() => openCombobox(combobox(view.container, 'Media type')))
  await act(async () => {
    await until(() => all(document, '[role="option"]').length > 0)
  })
  act(() => click(option(document, 'image')))
  expect(view.container.textContent).toContain('No media matches')

  typeText(search, image)
  expect(all(view.container, '.media-card')).toHaveLength(1)
  expect(view.container.textContent).toContain(image)
  typeText(search, '')
  act(() => openCombobox(combobox(view.container, 'Media type')))
  await act(async () => {
    await until(() => all(document, '[role="option"]').length > 0)
  })
  act(() => click(option(document, 'All media')))
  expect(all(view.container, '.media-card')).toHaveLength(2)
  expect(view.container.textContent).toContain(notes)
}

it('gallery accepts multi-file uploads, protects active uploads and filters media', async () => {
  const imagePayload = 'gallery image bytes'
  const filePayload = 'Private gallery notes'
  const image = mediaAsset({
    assetId: imageId,
    filename: 'gallery-image.png',
    role: 'image',
    type: 'image/png',
    bytes: imagePayload.length,
  })
  const notes = mediaAsset({
    assetId: fileId,
    filename: 'gallery-notes.txt',
    role: 'file',
    type: 'text/plain',
    bytes: filePayload.length,
  })
  const hold = defer()
  const started = defer()
  const view = mountMediaGallery(mediaGalleryHandlers({
    uploadAssets: [image, notes],
    transfer: async (asset, _call, attempt) => {
      if (attempt === 1) {
        started.open()
        await hold.promise
      }
      return { body: asset }
    },
  }))

  try {
    await waitForGallery(view)
    const dialog = openUploadDialog(view)
    selectFiles(mediaFileInput(dialog), [
      mediaFile(image.filename, image.type, imagePayload),
      mediaFile(notes.filename, notes.type, filePayload),
    ])
    expect(all(dialog, '.media-upload-item[data-state="queued"]')).toHaveLength(2)

    act(() => click(button(dialog, 'Upload files')))
    await started.promise
    expect(all(dialog, '.media-upload-item[data-state="uploading"]')).toHaveLength(1)
    expect(button(dialog, 'Close').disabled).toBe(true)
    press(dialog, 'Escape')
    expect(document.body.contains(dialog)).toBe(true)

    hold.open()
    await act(async () => {
      await view.api.expectServed()
    })
    await expectCompleteUploads(dialog, 2)
    await exerciseMediaFilters(view, dialog, image.filename, notes.filename)
  }
  finally {
    hold.open()
  }
})

it('upload dialog and mobile drawer keep queued files and choose the compact branch', async () => {
  const filename = 'queued-across-layout.txt'
  const payload = 'Keep this selected'
  const asset = mediaAsset({
    assetId: '2bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    filename,
    role: 'file',
    type: 'text/plain',
    bytes: payload.length,
  })
  const view = mountMediaGallery(mediaGalleryHandlers({
    uploadAssets: [asset],
  }), { width: 1440 })

  await waitForGallery(view)
  const desktopDialog = openUploadDialog(view)
  selectFiles(mediaFileInput(desktopDialog), [
    mediaFile(filename, 'text/plain', payload),
  ])
  expect(all(desktopDialog, '.media-upload-item[data-state="queued"]')).toHaveLength(1)
  act(() => click(button(desktopDialog, 'Close')))
  expect(view.container.querySelector('.media-session-note')?.textContent).toContain('Uploads stay available')

  setMediaState({ width: 320 })
  const mobileDialog = openUploadDialog(view)
  expect(mobileDialog.classList.contains('media-upload-drawer')).toBe(true)
  expect(mobileDialog.textContent).toContain(filename)
  expect(all(mobileDialog, '.media-upload-item[data-state="queued"]')).toHaveLength(1)
  act(() => click(button(mobileDialog, 'Upload files')))
  await expectCompleteUploads(mobileDialog, 1)
  await act(async () => {
    await view.api.expectServed()
  })
})
