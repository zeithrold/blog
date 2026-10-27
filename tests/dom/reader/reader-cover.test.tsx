import { afterEach, expect, it } from 'vitest'
import { emptyDocument } from '@/content/document'
import { one } from '~/tests/dom/shared/dom'
import { mountReader, resetReaders } from './reader-support'

afterEach(resetReaders)

const assetId = 'b36ca337-6220-44a7-8f75-aae05abf0464'

for (const privatePreview of [false, true]) {
  it(`renders a cover before the reading column with the ${privatePreview ? 'private' : 'public'} asset URL`, () => {
    const document = emptyDocument()
    document.meta.title = 'A covered article'
    document.meta.cover = { assetId, alt: 'Mountains at sunrise' }
    const view = mountReader(document, privatePreview)
    const article = one<HTMLElement>(view.container, 'article.reader')
    const cover = one<HTMLElement>(article, '.reader-cover')
    const image = one<HTMLImageElement>(cover, 'img')
    const column = one<HTMLElement>(article, '.reader-column')

    expect(cover.nextElementSibling).toBe(column)
    expect(column.querySelector('h1')?.textContent).toBe('A covered article')
    expect(column.querySelector('.reader-body')).not.toBeNull()
    expect(image.getAttribute('src')).toBe(
      privatePreview ? `/api/admin/assets/${assetId}/content` : `/assets/${assetId}`,
    )
    expect(image.alt).toBe('Mountains at sunrise')
    expect(image.getAttribute('loading')).toBe('eager')
    expect(image.getAttribute('fetchpriority')).toBe('high')
  })
}

for (const cover of [undefined, null]) {
  it(`omits the cover region when cover is ${String(cover)}`, () => {
    const document = emptyDocument()
    document.meta.cover = cover
    const view = mountReader(document)

    expect(view.container.querySelector('.reader-cover')).toBeNull()
    expect(one(view.container, 'article.reader').firstElementChild?.classList.contains('reader-column')).toBe(true)
  })
}

it('preserves an empty alt for a decorative cover', () => {
  const document = emptyDocument()
  document.meta.cover = { assetId, alt: '' }
  const view = mountReader(document)

  expect(one<HTMLImageElement>(view.container, '.reader-cover img').getAttribute('alt')).toBe('')
})
