import type { MountedEditorMedia } from './media-support'
import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { all, click, field, one } from './dom'
import { until } from './environment'
import {
  mediaAsset,
  mediaFile,
  mediaGalleryHandlers,
  mountEditorMedia,
  resetMediaDom,
  selectFiles,
} from './media-support'

afterEach(resetMediaDom)

async function completeUpload(view: MountedEditorMedia, dialog: HTMLElement): Promise<void> {
  act(() => click(one<HTMLButtonElement>(dialog, '.media-upload-actions button')))
  const row = all<HTMLElement>(dialog, '.media-upload-item')[0]
  if (row === undefined) {
    throw new Error('The editor upload queue did not render its file')
  }
  expect(row.dataset.state).toBe('uploading')
  await act(async () => {
    try {
      await until(() => row.dataset.state === 'complete' || row.dataset.state === 'failed')
    }
    catch {
      throw new Error(`The editor upload row stayed in ${row.dataset.state ?? 'an unknown state'}`)
    }
  })
  expect(row.dataset.state).toBe('complete')
  expect(all(dialog, '.media-upload-item[data-state="complete"]')).toHaveLength(1)
  await act(async () => {
    await view.api.expectServed()
  })
  expect(view.api.calls.some(call => call.method === 'POST')).toBe(true)
}

async function chooseListedAsset(
  view: MountedEditorMedia,
  dialog: HTMLElement,
  filename: string,
): Promise<void> {
  const tab = all(dialog, '[role="tab"]').find(item => item.textContent === 'Media library')
  if (tab === undefined) {
    throw new Error('The editor media library tab did not render')
  }
  act(() => {
    tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    tab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }))
    tab.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }))
  })
  expect(tab.getAttribute('data-state')).toBe('active')
  await act(async () => {
    await view.api.expectServed()
  })
  expect(view.api.calls.some(call => call.method === 'GET' && call.path === '/api/admin/assets'))
    .toBe(true)
  await act(async () => {
    await until(() => all(document.body, '.editor-media-card').length === 1)
  })
  const card = one(document.body, '.editor-media-card')
  expect(card.textContent).toContain(filename)
  act(() => click(one<HTMLButtonElement>(card, 'button[aria-label="Use media"]')))
  expect(view.selected()).toBeDefined()
  expect(view.isOpen()).toBe(false)
}

for (const width of [390, 1440]) {
  it(`editor media dialog uploads and selects a listed asset at ${width}px`, async () => {
    const filename = `editor-dialog-upload-${width}.txt`
    const payload = 'Upload from the editor media dialog'
    const uploaded = mediaAsset({
      assetId: '2eeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
      filename,
      role: 'file',
      type: 'text/plain',
      bytes: payload.length,
    })
    const listed = mediaAsset({
      assetId: '2fffffff-ffff-4fff-8fff-fffffffffff1',
      filename: `editor-library-${width}.png`,
      role: 'image',
      type: 'image/png',
      bytes: 12,
    })
    const view = mountEditorMedia(mediaGalleryHandlers({
      listing: () => [listed],
      uploadAssets: [uploaded],
    }), { locale: 'en', width })
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog).not.toBeNull()
    if (dialog === null) {
      throw new Error('The editor media dialog did not open')
    }
    expect(dialog.textContent).toContain('Add media')
    expect(dialog.classList.contains(width < 1100 ? 'editor-media-drawer' : 'editor-media-dialog'))
      .toBe(true)

    const input = field(dialog, 'Media file')
    if (!(input instanceof HTMLInputElement)) {
      throw new TypeError('The media file control is not an input')
    }
    selectFiles(input, [
      mediaFile(filename, 'text/plain', payload),
    ])
    expect(all(dialog, '.media-upload-item[data-state="queued"]')).toHaveLength(1)
    await completeUpload(view, dialog)
    await chooseListedAsset(view, dialog, listed.filename)
    expect(view.selected()).toEqual(listed)
  })
}
