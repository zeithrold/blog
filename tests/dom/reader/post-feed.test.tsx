import type { PublicFeedItem } from '@/server/reader/public-repository'
import { createElement } from 'react'
import { expect, it } from 'vitest'
import { PostFeed } from '@/features/reader/post-feed'
import { renderWithLocale } from '~/tests/support/unit/render-fixture'

function feedItem(overrides: Partial<PublicFeedItem> = {}): PublicFeedItem {
  return {
    title: 'Feed card',
    description: '',
    path: '/posts/feed-card',
    publishedAt: Date.UTC(2026, 0, 12),
    updatedAt: Date.UTC(2026, 0, 13),
    documentId: crypto.randomUUID(),
    cover: null,
    tags: [],
    ...overrides,
  }
}

function card(html: string, title: string): string {
  const cards = html.match(/<li[^>]*data-feed-item[^>]*>[\s\S]*?<\/li>/g) ?? []
  const matches = cards.filter(entry => entry.includes(`>${title}<`))
  expect(matches).toHaveLength(1)
  return matches[0] ?? ''
}

function feedFixture(): PublicFeedItem[] {
  return [
    feedItem({
      title: 'First feed card',
      path: '/posts/first',
      cover: {
        assetId: '11111111-1111-4111-8111-111111111111',
        alt: 'A quiet desk',
      },
    }),
    feedItem({
      title: 'Second feed card',
      path: '/posts/second',
      description: 'Plain text cards are a first-class style.',
    }),
    feedItem({
      title: 'Third feed card',
      path: '/posts/third',
      cover: {
        assetId: '22222222-2222-4222-8222-222222222222',
        alt: '',
      },
    }),
  ]
}

/*
 * The server render is the no-JavaScript fallback: a plain two-column grid of
 * cards in DOM order, without measured row spans. Layout itself is not proven
 * here; real geometry, column balance and image decoding remain browser work.
 */
it('server feed keeps DOM order and a plain grid fallback', () => {
  const html = renderWithLocale(createElement(PostFeed, {
    items: feedFixture(),
    start: 6,
  }))
  const firstIndex = html.indexOf('First feed card')
  const secondIndex = html.indexOf('Second feed card')
  const thirdIndex = html.indexOf('Third feed card')
  expect(firstIndex).toBeGreaterThan(-1)
  expect(firstIndex).toBeLessThan(secondIndex)
  expect(secondIndex).toBeLessThan(thirdIndex)
  expect(html).toContain('post-feed grid')
  expect(html).toContain('start="7"')
  expect(html).toContain('min-[702px]:grid-cols-2')
  expect(html).not.toContain('grid-auto-rows')
  expect(html).not.toContain('grid-row-end')

  const textOnly = card(html, 'Second feed card')
  expect(textOnly).not.toContain('<img')
  expect(textOnly).toContain('post-feed-body')
  expect(textOnly).toContain('Plain text cards are a first-class style.')
  expect(textOnly).toContain('>08<')
})

it('cover cards carry the public asset URL, alt text and reserved box', () => {
  const html = renderWithLocale(createElement(PostFeed, {
    items: feedFixture(),
    start: 6,
  }))
  const covered = card(html, 'First feed card')
  expect(covered).toContain('href="/posts/first"')
  expect(covered).toContain('aria-labelledby="feed-post-')
  expect(covered).toContain('src="/assets/11111111-1111-4111-8111-111111111111"')
  expect(covered).toContain('alt="A quiet desk"')
  expect(covered).toContain('width="960"')
  expect(covered).toContain('height="640"')
  expect(covered).toContain('loading="lazy"')
  expect(covered).toContain('decoding="async"')
  expect(covered).toContain('>07<')

  const decorative = card(html, 'Third feed card')
  expect(decorative).toContain('alt=""')
  expect(decorative).toContain('>09<')
})

it('empty feed reuses the published-posts empty state', () => {
  const html = renderWithLocale(createElement(PostFeed, { items: [] }))
  expect(html).toContain('No published posts yet.')
  expect(html).not.toContain('post-feed grid')
})

it('feed cards display snapshot colors and keep one article link without an empty tag row', () => {
  const html = renderWithLocale(createElement(PostFeed, { items: [
    feedItem({
      title: 'Tagged card',
      tags: [
        { id: crypto.randomUUID(), slug: 'systems', label: '系统设计', color: 'blue' },
        { id: crypto.randomUUID(), slug: 'legacy', label: 'Legacy label' },
      ],
    }),
    feedItem({ title: 'Untagged card' }),
  ] }))
  const tagged = card(html, 'Tagged card')
  expect(tagged).toContain('data-tag-color="blue"')
  expect(tagged).toContain('系统设计')
  expect(tagged).toContain('data-tag-color="neutral"')
  expect(tagged.match(/lucide-hash/g)).toHaveLength(2)
  expect(tagged.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(2)
  expect(tagged.match(/<a /g)).toHaveLength(1)
  expect(tagged).not.toContain('href="/tags/')
  expect(card(html, 'Untagged card')).not.toContain('post-feed-tags')
})

it('card entrance uses a bounded stagger independent of pagination and masonry sizing', () => {
  const items = Array.from({ length: 8 }, (_, index) => feedItem({ title: `Entry ${index}` }))
  const html = renderWithLocale(createElement(PostFeed, { items, start: 50 }))
  expect(card(html, 'Entry 0')).toContain('animation-delay:0ms')
  expect(card(html, 'Entry 1')).toContain('animation-delay:35ms')
  expect(card(html, 'Entry 5')).toContain('animation-delay:175ms')
  expect(card(html, 'Entry 7')).toContain('animation-delay:175ms')
  expect(html).not.toContain('opacity:0')
  expect(html).not.toContain('grid-row-end')
})
