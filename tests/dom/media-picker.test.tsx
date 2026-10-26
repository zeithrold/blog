import type { MountedEditorMedia } from './media-support'
import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { allocateAssetSchema } from '@/contracts/media'
import { all, click, containing, field, one } from './dom'
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

const cardScenarios = [
  {
    width: 320,
    locale: 'zh-CN',
    mode: 'dark',
    library: '媒体库',
    use: '使用此媒体',
    open: '打开媒体',
    fileRole: '文件',
  },
  {
    width: 390,
    locale: 'zh-CN',
    mode: 'light',
    library: '媒体库',
    use: '使用此媒体',
    open: '打开媒体',
    fileRole: '文件',
  },
  {
    width: 1440,
    locale: 'en',
    mode: 'light',
    library: 'Media library',
    use: 'Use media',
    open: 'Open media',
    fileRole: 'file',
  },
] as const

type CardScenario = (typeof cardScenarios)[number]

async function openLibrary(view: MountedEditorMedia, label: string): Promise<void> {
  const libraryTab = all(document.body, '[role="tab"]')
    .find(tab => tab.textContent.trim() === label)
  if (libraryTab === undefined) {
    throw new Error('The media library tab did not render')
  }
  act(() => {
    libraryTab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    libraryTab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }))
    libraryTab.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, cancelable: true }))
  })
  expect(libraryTab.getAttribute('data-state')).toBe('active')
  await act(async () => {
    await view.api.expectServed()
  })
  await act(async () => {
    await until(() => all(document.body, '.editor-media-card').length === 2)
  })
}

function proveLibraryCard(
  view: MountedEditorMedia,
  scenario: CardScenario,
  image: ReturnType<typeof mediaAsset>,
  file: ReturnType<typeof mediaAsset>,
): void {
  const imageCard = containing(document.body, '.editor-media-card', image.filename)
  expect(imageCard.textContent).toContain(image.filename)
  const preview = one<HTMLImageElement>(imageCard, 'img')
  expect(preview.getAttribute('src')).toBe(`/api/admin/assets/${image.assetId}/content`)
  const use = one<HTMLButtonElement>(imageCard, `button[aria-label="${scenario.use}"]`)
  expect(use.disabled).toBe(false)
  const describedBy = use.getAttribute('aria-describedby')
  if (describedBy === null) {
    throw new Error('The media choice has no filename description')
  }
  const description = document.getElementById(describedBy)
  if (description === null) {
    throw new Error('The media choice description did not resolve')
  }
  expect(description.textContent).toBe(image.filename)
  const open = one<HTMLAnchorElement>(imageCard, `a[aria-label="${scenario.open}"]`)
  expect(open.getAttribute('href')).toBe(`/api/admin/assets/${image.assetId}/content`)
  expect(open.getAttribute('target')).toBe('_blank')

  const fileCard = containing(document.body, '.editor-media-card', file.filename)
  expect(fileCard.textContent.replaceAll(/\s+/g, ' ').trim())
    .toContain(`${scenario.fileRole} · 14 B`)
  act(() => click(use))
  expect(view.selected()).toEqual(image)
  expect(view.isOpen()).toBe(false)
  expect(all(document.body, '[role="dialog"]')).toHaveLength(0)
}

for (const scenario of cardScenarios) {
  it(`media cards expose their selection and preview in ${scenario.locale} at ${scenario.width}px`, async () => {
    const image = mediaAsset({
      assetId: '27777777-7777-4777-8777-777777777777',
      filename: `picker-${scenario.width}-photo.png`,
      role: 'image',
      type: 'image/png',
      bytes: 8,
    })
    const file = mediaAsset({
      assetId: '28888888-8888-4888-8888-888888888888',
      filename: `picker-${scenario.width}-notes.txt`,
      role: 'file',
      type: 'text/plain',
      bytes: 14,
    })
    const view = mountEditorMedia(mediaGalleryHandlers({
      listing: () => [image, file],
    }), {
      width: scenario.width,
      locale: scenario.locale,
      mode: scenario.mode,
    })
    await openLibrary(view, scenario.library)
    proveLibraryCard(view, scenario, image, file)
  })
}

const uploadScenarios = [
  { width: 320, locale: 'zh-CN', mode: 'light', fileLabel: '媒体文件' },
  { width: 682, locale: 'zh-CN', mode: 'dark', fileLabel: '媒体文件' },
  { width: 1440, locale: 'en', mode: 'light', fileLabel: 'Media file' },
] as const

for (const scenario of uploadScenarios) {
  it(`upload picker accepts file changes and completes both transfers at ${scenario.width}px`, async () => {
    const firstName = `picker-${scenario.width}-first.txt`
    const secondName = `picker-${scenario.width}-second.txt`
    const firstContents = 'Pointer upload'
    const secondContents = 'Keyboard upload'
    const first = mediaAsset({
      assetId: '29999999-9999-4999-8999-999999999991',
      filename: firstName,
      role: 'file',
      type: 'text/plain',
      bytes: firstContents.length,
    })
    const second = mediaAsset({
      assetId: '29999999-9999-4999-8999-999999999992',
      filename: secondName,
      role: 'file',
      type: 'text/plain',
      bytes: secondContents.length,
    })
    const view = mountEditorMedia(mediaGalleryHandlers({
      uploadAssets: [first, second],
    }), {
      width: scenario.width,
      locale: scenario.locale,
      mode: scenario.mode,
    })
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    if (dialog === null) {
      throw new Error('The editor media dialog did not open')
    }
    expect(dialog.classList.contains(scenario.width < 1100 ? 'editor-media-drawer' : 'editor-media-dialog'))
      .toBe(true)
    const input = field(dialog, scenario.fileLabel)
    if (!(input instanceof HTMLInputElement)) {
      throw new TypeError('The media file control is not an input')
    }
    selectFiles(input, [
      mediaFile(firstName, 'text/plain', firstContents),
    ])
    selectFiles(input, [
      mediaFile(secondName, 'text/plain', secondContents),
    ])
    expect(all(dialog, '.media-upload-item[data-state="queued"]')).toHaveLength(2)

    const upload = one<HTMLButtonElement>(dialog, '.media-upload-actions button')
    act(() => click(upload))
    await act(async () => {
      await until(() => all(dialog, '.media-upload-item[data-state="complete"]').length === 2)
      await view.api.expectServed()
    })
    expect(all(dialog, '.media-upload-item[data-state="complete"]')).toHaveLength(2)
    const allocations = view.api.calls.filter(call => call.method === 'POST')
    expect(allocations.map(call => allocateAssetSchema.parse(call.json).filename))
      .toEqual([firstName, secondName])
    const transfers = view.api.calls.filter(call => call.method === 'PUT')
    expect(transfers.map(call => call.path)).toEqual([
      `/api/admin/assets/${first.assetId}/content`,
      `/api/admin/assets/${second.assetId}/content`,
    ])
  })
}
