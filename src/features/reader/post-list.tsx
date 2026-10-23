import type { ReactNode } from 'react'
import type { PublicItem } from '@/server/reader/public-repository'
import { ArrowRight, ArrowUp, PenLine } from 'lucide-react'
import Link from 'next/link'
import { SiteDate, SiteText } from '@/i18n/site-text'

const emptyStateStyle1 = ['empty-state flex items-center gap-5 border-y border-border py-12 max-[701px]:py-9'].join(' ')

const emptyIconStyle2 = [
  'empty-icon grid place-items-center size-12 shrink-0 rounded-sm bg-muted text-muted-foreground',
].join(' ')

const postEntryStyle3 = [
  'post-entry group grid grid-cols-[140px_minmax(0,1fr)_32px] gap-8 items-center border-t',
  'border-border py-7 text-inherit no-underline transition-colors duration-200 hover:bg-muted/40',
  'motion-reduce:transition-none max-[960px]:grid-cols-[120px_minmax(0,1fr)_32px] max-[960px]:gap-6',
  'max-[701px]:grid-cols-[minmax(0,1fr)_24px] max-[701px]:gap-x-3 max-[701px]:gap-y-3',
  'max-[701px]:py-6',
].join(' ')

const postMetaStyle4 = [
  'post-meta flex flex-col gap-2 text-muted-foreground text-help tabular-nums max-[701px]:col-span-2',
  'max-[701px]:flex-row max-[701px]:gap-4',
].join(' ')

const postTitleStyle5 = [
  'post-title m-0 text-[length:21px] font-medium tracking-[-.025em] leading-[1.4] wrap-anywhere',
  'max-[701px]:text-[length:19px]',
].join(' ')

const postDescriptionStyle6 = [
  'post-description max-w-[62ch] mt-2 mb-0 text-muted-foreground text-body leading-[1.8]',
  'wrap-anywhere',
].join(' ')

const postArrowStyle7 = [
  'post-arrow grid place-items-center size-8 text-muted-foreground transition-transform duration-200',
  'group-hover:translate-x-1 group-hover:text-foreground motion-reduce:transition-none',
  'max-[701px]:size-6',
].join(' ')

const siteAfterwordStyle8 = [
  'site-afterword flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-5 pb-6 border-t',
  'border-border text-muted-foreground [&_p]:m-0 [&_p]:text-help',
].join(' ')

const backTopStyle9 = [
  'back-top inline-flex items-center gap-2 min-h-11 text-help no-underline hover:text-foreground',
].join(' ')

export function PostList({ items, start = 0 }: { items: PublicItem[], start?: number }): ReactNode {
  if (items.length === 0) {
    return (
      <div className={emptyStateStyle1}>
        <span className={emptyIconStyle2} aria-hidden="true"><PenLine size={23} strokeWidth={1.5} /></span>
        <div>
          <p className="empty-title m-0 mb-1 text-body font-medium"><SiteText value="No published posts yet." /></p>
          <p className="m-0 text-muted-foreground text-help leading-[1.8]">
            <SiteText value="New writing will appear here once it is published." />
          </p>
        </div>
      </div>
    )
  }
  return (
    <ol className="post-list grid m-0 p-0 list-none border-b border-border">
      {items.map((post, index) => (
        <li key={post.documentId}>
          <Link href={post.path} className={postEntryStyle3} aria-labelledby={`post-${post.documentId}`}>
            <span className={postMetaStyle4}>
              <span className="collection-number font-mono text-accent-foreground">
                {String(start + index + 1).padStart(2, '0')}
              </span>
              <SiteDate value={post.publishedAt} />
            </span>
            <div className="post-body min-w-0">
              <h3 className={postTitleStyle5} id={`post-${post.documentId}`}>{post.title}</h3>
              {post.description !== '' && <p className={postDescriptionStyle6}>{post.description}</p>}
            </div>
            <span className={postArrowStyle7} aria-hidden="true"><ArrowRight size={17} /></span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

export function SiteAfterword(): ReactNode {
  return (
    <div className={siteAfterwordStyle8}>
      <p><SiteText value="Notes on building things." /></p>
      <a href="#top" className={backTopStyle9}>
        <SiteText value="Back to top" />
        <ArrowUp size={14} aria-hidden="true" />
      </a>
    </div>
  )
}
