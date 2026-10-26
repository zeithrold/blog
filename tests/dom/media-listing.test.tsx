import type { MountedGallery } from './media-support'
import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { all, button, click, field } from './dom'
import { until } from './environment'
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

function chooseFile(dialog: HTMLElement, filename: string, payload: string): void {
  const input = field(dialog, 'Media file')
  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('The media file control is not an input')
  }
  selectFiles(input, [
    mediaFile(filename, 'text/plain', payload),
  ])
}

function startUpload(dialog: HTMLElement): void {
  act(() => click(button(dialog, 'Upload files')))
}

async function waitForCompletion(dialog: HTMLElement): Promise<void> {
  await act(async () => {
    await until(() => all(dialog, '.media-upload-item[data-state="complete"]').length === 1)
  })
}

it('a delayed gallery refresh keeps an upload completed while it was reading', async () => {
  const filename = 'listing-race.txt'
  const payload = 'Confirmed upload'
  const asset = mediaAsset({
    assetId: '25555555-5555-4555-8555-555555555555',
    filename,
    role: 'file',
    type: 'text/plain',
    bytes: payload.length,
  })
  const captured = defer()
  const hold = defer()
  const view = mountMediaGallery(mediaGalleryHandlers({
    listing: async (_call, read) => {
      if (read > 1) {
        captured.open()
        await hold.promise
      }
      return []
    },
    uploadAssets: [asset],
  }))

  try {
    await waitForGallery(view)
    const dialog = openUploadDialog(view)
    chooseFile(dialog, filename, payload)
    act(() => click(button(dialog, 'Close')))

    act(() => click(button(view.container, 'Refresh')))
    await captured.promise
    const reopened = openUploadDialog(view)
    startUpload(reopened)
    await waitForCompletion(reopened)
    expect(all(reopened, '.media-upload-item[data-state="complete"]')).toHaveLength(1)

    hold.open()
    await act(async () => {
      await until(() => !view.session.snapshot().loading)
      await view.api.expectServed()
    })
    expect(all(view.container, '.media-card')).toHaveLength(1)
    expect(view.container.textContent).toContain(filename)
  }
  finally {
    hold.open()
  }
})

it('a later authoritative gallery refresh removes a card absent from the server listing', async () => {
  const filename = 'listing-authoritative.txt'
  const payload = 'Accepted upload'
  const asset = mediaAsset({
    assetId: '26666666-6666-4666-8666-666666666666',
    filename,
    role: 'file',
    type: 'text/plain',
    bytes: payload.length,
  })
  const view = mountMediaGallery(mediaGalleryHandlers({
    listing: () => [],
    uploadAssets: [asset],
  }))

  await waitForGallery(view)
  const dialog = openUploadDialog(view)
  chooseFile(dialog, filename, payload)
  startUpload(dialog)
  await waitForCompletion(dialog)
  act(() => click(button(dialog, 'Close')))
  expect(all(view.container, '.media-card')).toHaveLength(1)

  act(() => click(button(view.container, 'Refresh')))
  await act(async () => {
    await until(() => view.api.calls.filter(call =>
      call.method === 'GET' && call.path === '/api/admin/assets').length === 2)
    await until(() => !view.session.snapshot().loading)
    await view.api.expectServed()
  })
  expect(all(view.container, '.media-card')).toHaveLength(0)
  expect(view.container.textContent).toContain('No media yet')
})
