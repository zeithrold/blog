'use client'

import type { ReactNode } from 'react'
import type { PublicFeedItem } from '@/server/reader/public-repository'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { FEED_ROW_HEIGHT, masonrySpan } from '@/features/reader/post-feed-masonry'
import { PostListEmpty } from '@/features/reader/post-list'
import { SiteDate } from '@/i18n/site-text'

/*
 * A measured grid masonry: items keep DOM order, and only the row span is
 * computed after mount. Without JavaScript every card still lays out in a
 * plain two-column grid; no column-flow or column-major ordering is used.
 */

type Spans = Record<string, number>

const feedClass = [
  'post-feed grid grid-cols-1 items-start gap-x-8 m-0 p-0 list-none',
  'min-[702px]:grid-cols-2',
].join(' ')

const itemClass = 'post-feed-item min-w-0 pb-6'

const cardClass = [
  'post-feed-card group flex flex-col overflow-hidden rounded-[var(--blog-radius-card)]',
  'border border-border bg-card text-inherit no-underline transition-colors duration-200',
  'hover:bg-muted/20 motion-reduce:transition-none',
].join(' ')

const coverClass = 'post-feed-cover overflow-hidden border-b border-border bg-muted'

const coverImageClass = 'block w-full h-auto aspect-[3/2] object-cover'

const bodyClass = 'post-feed-body flex flex-col px-5 py-5'

const bodyTextClass = 'post-feed-body flex flex-col px-6 py-6'

const metaClass = 'post-feed-meta flex items-center gap-3 m-0 text-muted-foreground text-help tabular-nums'

const arrowClass = [
  'post-feed-arrow ml-auto grid place-items-center text-muted-foreground',
  'transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none',
].join(' ')

const titleClass = [
  'post-feed-title mt-3.5 mb-0 font-serif text-[length:23px] font-medium leading-[1.4]',
  'tracking-[-.025em] wrap-anywhere [html:lang(zh-CN)_&]:tracking-normal [html:lang(zh-CN)_&]:leading-[1.5]',
  'max-[701px]:text-[length:21px]',
].join(' ')

const descriptionClass = [
  'post-feed-description line-clamp-4 mt-2.5 mb-0 text-muted-foreground text-body leading-[1.8]',
  'wrap-anywhere',
].join(' ')

export function PostFeed({ items, start = 0 }: { items: PublicFeedItem[], start?: number }): ReactNode {
  const { listRef, spans } = useFeedSpans(items)
  if (items.length === 0) {
    return <PostListEmpty />
  }
  return (
    <ol
      ref={listRef}
      start={start + 1}
      className={feedClass}
      style={spans === null ? undefined : { gridAutoRows: `${FEED_ROW_HEIGHT}px` }}
    >
      {items.map((post, index) => (
        <li
          key={post.documentId}
          data-feed-item={post.documentId}
          className={itemClass}
          style={spanStyle(spans, post.documentId)}
        >
          <Link
            href={post.path}
            className={cardClass}
            style={{ animationDelay: `${Math.min(index, 5) * 35}ms` }}
            aria-labelledby={`feed-post-${post.documentId}`}
          >
            {post.cover !== null && (
              <div className={coverClass}>
                <img
                  className={coverImageClass}
                  src={`/assets/${post.cover.assetId}`}
                  alt={post.cover.alt}
                  width={960}
                  height={640}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}
            <div className={post.cover === null ? bodyTextClass : bodyClass}>
              <span className={metaClass}>
                <span className="collection-number font-mono text-accent-foreground">
                  {String(start + index + 1).padStart(2, '0')}
                </span>
                <SiteDate value={post.publishedAt} />
                <span className={arrowClass} aria-hidden="true"><ArrowRight size={16} /></span>
              </span>
              <h3 className={titleClass} id={`feed-post-${post.documentId}`}>{post.title}</h3>
              {post.description !== '' && <p className={descriptionClass}>{post.description}</p>}
              <FeedTags tags={post.tags} />
            </div>
          </Link>
        </li>
      ))}
    </ol>
  )
}

function FeedTags({ tags }: { tags: PublicFeedItem['tags'] }): ReactNode {
  if (tags.length === 0) {
    return null
  }
  return (
    <div className="post-feed-tags flex flex-wrap gap-2 mt-4">
      {tags.map(tag => (
        <span
          key={tag.id}
          className={[
            'tag-color inline-flex rounded-full border border-border px-2.5 py-1',
            'text-help text-muted-foreground wrap-anywhere max-w-full',
          ].join(' ')}
          data-tag-color={tag.color ?? 'neutral'}
        >
          {tag.label}
        </span>
      ))}
    </div>
  )
}

function spanStyle(spans: Spans | null, id: string): { gridRowEnd: string } | undefined {
  const span = spans?.[id]
  return span === undefined ? undefined : { gridRowEnd: `span ${span}` }
}

function useFeedSpans(items: PublicFeedItem[]): {
  listRef: React.RefObject<HTMLOListElement | null>
  spans: Spans | null
} {
  const listRef = useRef<HTMLOListElement>(null)
  const [spans, setSpans] = useState<Spans | null>(null)
  useEffect(() => {
    const list = listRef.current
    if (list === null) {
      return
    }
    const measure = (): void => {
      const next: Spans = {}
      for (const card of list.querySelectorAll<HTMLElement>('[data-feed-item]')) {
        const id = card.dataset.feedItem
        if (id === undefined) {
          continue
        }
        next[id] = masonrySpan(card.getBoundingClientRect().height)
      }
      setSpans(old => sameSpans(old, next) ? old : next)
    }
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    // Observation reports the first size asynchronously, so the server markup
    // and the hydration render stay identical; no setState runs synchronously.
    const observer = new ResizeObserver(measure)
    for (const card of list.querySelectorAll<HTMLElement>('[data-feed-item]')) {
      observer.observe(card)
    }
    return () => observer.disconnect()
  }, [items])
  // Apply spans only once every current card has one; a newly replaced list
  // keeps the readable auto-row fallback until observation catches up.
  const complete = spans !== null && items.every(item => spans[item.documentId] !== undefined)
  return {
    listRef,
    spans: complete ? spans : null,
  }
}

function sameSpans(old: Spans | null, next: Spans): boolean {
  if (old === null) {
    return false
  }
  const keys = Object.keys(next)
  return keys.length === Object.keys(old).length && keys.every(key => old[key] === next[key])
}
