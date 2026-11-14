import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DocumentReader } from '@/features/reader/document'
import { PostFeed } from '@/features/reader/post-feed'
import { PostList, SiteAfterword } from '@/features/reader/post-list'
import { installBrowserShims } from '~/tests/dom/shared/environment'
import { mountPublic } from '../shell/public-support'
import { pageFixture, publicItem } from './notion-fixture'

vi.mock('next/navigation', async importOriginal => ({
  ...await importOriginal<typeof import('next/link')>(),
  useRouter: () => ({ refresh: vi.fn() }),
}))

let view: ReturnType<typeof mountPublic> | undefined

beforeEach(installBrowserShims)
afterEach(() => {
  view?.unmount()
  view = undefined
})

it('renders the real Notion body beneath one Zeithrold header and signed cover', () => {
  view = mountPublic(<DocumentReader page={pageFixture()} />)
  const { container } = view
  expect(Array.from(container.querySelectorAll('h1'), node => node.textContent)).toEqual(['The public article'])
  expect(container.querySelector('.reader-cover img')?.getAttribute('src'))
    .toBe('https://media.example/cover.jpg?signature=one')
  expect(container.querySelector('.reader-cover')?.nextElementSibling?.classList.contains('reader-column')).toBe(true)
  expect(container.querySelector('.description')?.textContent).toBe('An article summary.')
  expect(container.querySelector('.notion-text b')?.textContent).toBe('Real rich text')
  expect(container.querySelector('.notion-h1')?.textContent).toContain('A body heading')
  expect(container.querySelector('.notion-code code')?.textContent).toBe('const answer = 42')
  expect(container.querySelector('.katex')).not.toBeNull()
  expect(container.querySelector('.reader-tags [data-tag-color="blue"]')?.textContent).toBe('Systems')
  expect(container.querySelector('.reader-tags a')?.getAttribute('href')).toBe('/tags/tag-blue')
})

it('maps eligible Notion links with fragments while keeping external links safe', () => {
  view = mountPublic(<DocumentReader page={pageFixture()} />)
  const links = Array.from(view.container.querySelectorAll<HTMLAnchorElement>('.notion-text a'))
  expect(links.map(link => [
    link.textContent,
    link.getAttribute('href'),
  ])).toEqual([
    ['Relative page', '/pages/linked#part-one'],
    ['Absolute page', '/pages/linked#part-two'],
    ['External site', 'https://example.org/guide#section'],
  ])
  expect(links.at(-1)?.rel).toBe('noopener noreferrer')
  expect(view.container.querySelector('.notion-text')?.textContent).toBe('Real rich text')
  expect(view.container.textContent).toContain('Unsafe link')
})

it('keeps feed card links in source order with native tags and pagination numbering', () => {
  const items = [
    publicItem(),
    publicItem({
      id: '33333333-3333-4333-8333-333333333333',
      path: '/posts/second',
      title: 'Second article',
      summary: '',
      cover: null,
      tags: [
        { id: 'tag-brown', label: 'Notes', color: 'brown' },
      ],
    }),
  ]
  view = mountPublic(<PostFeed items={items} start={6} />)
  const cards = Array.from(view.container.querySelectorAll<HTMLElement>('.post-feed-card'))
  const articleLinks = Array.from(
    view.container.querySelectorAll<HTMLAnchorElement>('a[aria-labelledby^="feed-post-"]'),
  )
  expect(articleLinks.map(link => link.getAttribute('href'))).toEqual(['/posts/first', '/posts/second'])
  expect(cards.map(card => card.querySelector('.collection-number')?.textContent)).toEqual(['07', '08'])
  expect(view.container.querySelector('ol')?.start).toBe(7)
  expect(view.container.querySelector('a a')).toBeNull()
  expect(articleLinks.map(link => link.getAttribute('aria-labelledby')))
    .toEqual(items.map(item => `feed-post-${item.id}`))
  expect(cards.map(card => card.querySelector('.reader-tag')?.getAttribute('href')))
    .toEqual(['/tags/tag-blue', '/tags/tag-brown'])
  expect(cards.map(card => card.querySelector('[data-tag-color]')?.getAttribute('data-tag-color')))
    .toEqual(['blue', 'brown'])
  expect(cards.at(0)?.querySelector('img')?.src).toBe('https://media.example/cover.jpg?signature=one')
  expect(cards.at(1)?.querySelector('img')).toBeNull()
})

it('keeps native tag identity when its label changes and encodes reserved ID characters', () => {
  const item = publicItem({ tags: [
    { id: 'native:/?#%', label: 'Before rename', color: 'blue' },
  ] })
  view = mountPublic(<PostFeed items={[item]} />)
  const href = '/tags/native%3A%2F%3F%23%25'
  expect(view.container.querySelector('.reader-tag')?.getAttribute('href')).toBe(href)
  view.render(
    <PostFeed items={[
      { ...item, tags: [
        { id: 'native:/?#%', label: 'Renamed', color: 'blue' },
      ] },
    ]}
    />,
  )
  expect(view.container.querySelector('.reader-tag')?.textContent).toBe('Renamed')
  expect(view.container.querySelector('.reader-tag')?.getAttribute('href')).toBe(href)
})

it('renders list summaries and the empty feed using the new public DTO', () => {
  view = mountPublic(
    <>
      <PostList
        items={[
          publicItem(),
        ]}
        start={2}
      />
      <SiteAfterword />
    </>,
  )
  expect(view.container.querySelector('.post-description')?.textContent).toBe('An article summary.')
  expect(view.container.querySelector('.post-title')?.textContent).toBe('The public article')
  expect(view.container.querySelector('.back-top')?.getAttribute('href')).toBe('#top')
  view.render(<PostFeed items={[]} />)
  expect(view.container.querySelector('.empty-title')?.textContent).toBe('No published posts yet.')
  expect(view.container.querySelector('ol')).toBeNull()
})
