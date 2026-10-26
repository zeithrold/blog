import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { all, button, click, combobox, field, openCombobox, option, typeText } from './dom'
import { until } from './environment'
import { mountMediaFields } from './media-fields-support'
import {
  mediaAsset,
  mediaGalleryHandlers,
  resetMediaDom,
} from './media-support'

afterEach(resetMediaDom)

const imageWidths = [390, 1440] as const

for (const width of imageWidths) {
  it(`image media fields expose only image descriptions at ${width}px`, async () => {
    const view = mountMediaFields('image', {
      alt: '',
      decorative: false,
      transcript: '',
      captionAssetId: null,
      posterAssetId: null,
    }, mediaGalleryHandlers(), { width })

    expect(field(view.container, 'Alternative text')).toBeInstanceOf(HTMLInputElement)
    expect(all(view.container, 'textarea')).toHaveLength(0)
    expect(all(view.container, '[role="combobox"]')).toHaveLength(0)
    expect(view.container.textContent).not.toContain('Transcript')
    expect(view.container.textContent).not.toContain('Video captions')

    typeText(field(view.container, 'Alternative text'), 'A separate image description')
    expect(view.value().alt).toBe('A separate image description')
    await act(async () => {
      await view.api.expectServed()
    })
  })
}

it('video media fields edit the transcript and select caption and poster assets', async () => {
  const caption = mediaAsset({
    assetId: '2ccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    filename: 'editor-captions.vtt',
    role: 'caption',
    type: 'text/vtt',
    bytes: 20,
  })
  const poster = mediaAsset({
    assetId: '2ddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    filename: 'editor-poster.png',
    role: 'poster',
    type: 'image/png',
    bytes: 12,
  })
  const view = mountMediaFields(
    'video',
    {
      alt: '',
      decorative: false,
      transcript: '',
      captionAssetId: null,
      posterAssetId: null,
    },
    mediaGalleryHandlers({ listing: () => [caption, poster] }),
    { locale: 'en', width: 390 },
  )

  await act(async () => {
    await view.api.expectServed()
  })
  typeText(field(view.container, 'Transcript'), 'A short frame with a caption.')
  expect(view.value().transcript).toBe('A short frame with a caption.')
  expect(view.container.textContent).not.toContain('Decorative image')

  act(() => openCombobox(combobox(view.container, 'Video captions')))
  await act(async () => {
    await until(() => all(document, '[role="option"]').length > 0)
  })
  act(() => click(option(document, caption.filename)))
  expect(view.value().captionAssetId).toBe(caption.assetId)

  act(() => openCombobox(combobox(view.container, 'Video poster')))
  await act(async () => {
    await until(() => all(document, '[role="option"]').length > 0)
  })
  act(() => click(option(document, poster.filename)))
  expect(view.value().posterAssetId).toBe(poster.assetId)

  act(() => click(button(view.container, 'Upload captions')))
  act(() => click(button(view.container, 'Upload poster')))
  expect(view.uploads()).toEqual(['caption', 'poster'])
})
