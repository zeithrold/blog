import type { MediaAsset } from '~/tests/components/support/media-fixtures'
import type { ComponentLocale, ComponentMode } from '~/tests/components/support/mount'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { serveGallery } from '~/tests/components/support/media-boundary'
import { assetFor, previewBytes } from '~/tests/components/support/media-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'
import { assertAccessible } from '~/tests/support/browser/accessibility'

const copy = {
  en: { gallery: 'Gallery', open: 'Open media', fileRole: 'file' },
  zh: { gallery: '图库', open: '打开媒体', fileRole: '文件' },
} as const

// The widths and appearances the browser case reached by uploading through the
// editor first; the cards themselves are what a listed asset renders.
const scenarios: readonly { width: number, locale: ComponentLocale, mode: ComponentMode }[] = [
  { width: 320, locale: 'zh', mode: 'dark' },
  { width: 390, locale: 'zh', mode: 'light' },
  { width: 1440, locale: 'en', mode: 'light' },
]

const note = Buffer.from('private note 1')

function listed(width: number): MediaAsset[] {
  return [
    assetFor(crypto.randomUUID(), {
      filename: `media-card-${width}.png`,
      role: 'image',
      type: 'image/png',
      bytes: previewBytes.byteLength,
      sha256: createHash('sha256').update(previewBytes).digest('hex'),
    }),
    assetFor(crypto.randomUUID(), {
      filename: `library-document-${width}.txt`,
      role: 'file',
      type: 'text/plain',
      bytes: note.byteLength,
      sha256: createHash('sha256').update(note).digest('hex'),
    }),
  ]
}

for (const { width, locale, mode } of scenarios) {
  test(`gallery cards keep their preview, link and layout in ${locale} at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const [image, file] = listed(width)
    if (image === undefined || file === undefined) {
      throw new Error('The listed media fixture is incomplete')
    }
    const gallery = await serveGallery(page, { listing: () => [image, file] })
    try {
      await mountSurface(page, { surface: 'media-gallery', locale, mode })
      const text = copy[locale]
      await expect(page.getByRole('list', { name: text.gallery, exact: true })).toBeVisible()

      // A ready image previews from its private content path, never the public URL.
      const content = `/api/admin/assets/${image.assetId}/content`
      const imageCard = page.locator('.media-card').filter({ hasText: image.filename })
      await expect(imageCard.locator('img')).toHaveAttribute('src', content)
      expect(await imageCard.locator('img').evaluate(element => getComputedStyle(element).objectFit)).toBe('contain')

      // The card's own link is the keyboard stop, named by the file it opens.
      const open = imageCard.getByRole('link', { name: text.open, exact: true })
      await expect(open).toHaveAttribute('href', content)
      await expect(open).toHaveAttribute('target', '_blank')
      await open.focus()
      await expect(open).toBeFocused()
      await expect(open).toHaveAccessibleDescription(image.filename)

      // The listed size and role are the summary the gallery shows for a file.
      await expect(page.locator('.media-card').filter({ hasText: file.filename }))
        .toContainText(`${text.fileRole} · 14 B`)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await assertAccessible(page, info, { label: `media-gallery-${width}` })
      await page.screenshot({ path: info.outputPath(`media-gallery-${width}.png`), fullPage: true })
      await gallery.api.expectServed()
    }
    finally {
      await gallery.api.dispose()
    }
  })
}
