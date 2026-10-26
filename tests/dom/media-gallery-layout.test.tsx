import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { all, containing, one } from './dom'
import { until } from './environment'
import {
  mediaAsset,
  mediaGalleryHandlers,
  mountMediaGallery,
  resetMediaDom,
} from './media-support'

afterEach(resetMediaDom)

const scenarios = [
  {
    width: 320,
    locale: 'zh-CN',
    mode: 'dark',
    gallery: '图库',
    open: '打开媒体',
    fileRole: '文件',
  },
  {
    width: 390,
    locale: 'zh-CN',
    mode: 'light',
    gallery: '图库',
    open: '打开媒体',
    fileRole: '文件',
  },
  {
    width: 1440,
    locale: 'en',
    mode: 'light',
    gallery: 'Gallery',
    open: 'Open media',
    fileRole: 'file',
  },
] as const

for (const scenario of scenarios) {
  it(`gallery cards expose their preview, link and summary in ${scenario.locale} at ${scenario.width}px`, async () => {
    const image = mediaAsset({
      assetId: '23333333-3333-4333-8333-333333333333',
      filename: `media-card-${scenario.width}.png`,
      role: 'image',
      type: 'image/png',
      bytes: 8,
    })
    const file = mediaAsset({
      assetId: '24444444-4444-4444-8444-444444444444',
      filename: `library-document-${scenario.width}.txt`,
      role: 'file',
      type: 'text/plain',
      bytes: 14,
    })
    const view = mountMediaGallery(mediaGalleryHandlers({
      listing: () => [image, file],
    }), {
      width: scenario.width,
      locale: scenario.locale,
      mode: scenario.mode,
    })

    await act(async () => {
      await until(() => view.session.snapshot().loaded)
      await view.api.expectServed()
    })

    const gallery = one(view.container, 'ul.media-gallery-grid')
    expect(gallery.getAttribute('aria-label')).toBe(scenario.gallery)
    expect(all(gallery, '.media-card')).toHaveLength(2)

    const imageCard = containing(gallery, '.media-card', image.filename)
    const preview = one<HTMLImageElement>(imageCard, 'img')
    expect(preview.getAttribute('src')).toBe(`/api/admin/assets/${image.assetId}/content`)
    expect(preview.getAttribute('alt')).toBe('')
    const open = one<HTMLAnchorElement>(imageCard, 'a.gallery-open')
    expect(open.getAttribute('aria-label')).toBe(scenario.open)
    expect(open.getAttribute('href')).toBe(`/api/admin/assets/${image.assetId}/content`)
    expect(open.getAttribute('target')).toBe('_blank')
    const description = open.getAttribute('aria-describedby')
    expect(description).not.toBeNull()
    expect(description === null ? null : document.getElementById(description)?.textContent)
      .toBe(image.filename)

    const fileCard = containing(gallery, '.media-card', file.filename)
    expect(fileCard.textContent.replaceAll(/\s+/g, ' ').trim())
      .toContain(`${scenario.fileRole} · 14 B`)
  })
}
