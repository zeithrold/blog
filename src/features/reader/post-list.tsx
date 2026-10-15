import type { ReactNode } from 'react'
import type { PublicItem } from '@/server/public-repository'
import { ArrowRight, ArrowUp, PenLine } from 'lucide-react'
import Link from 'next/link'
import { SiteDate, SiteText } from '@/i18n/site-text'

const utility1Class = [
  'empty-state flex items-start gap-4 p-6 [border:1px_dashed_var(--ztd-border)] rounded-[12px]',
].join(' ')

const utility2Class = [
  '[&_p]:m-0 [&_p]:text-muted-foreground [&_p]:text-help [&_p]:leading-[1.7]',
  '[&_.empty-title]:mt-0',
].join(' ')

const utility3Class = [
  '[&_.empty-title]:text-[length:15px] [&_.empty-title]:font-medium max-[701px]:p-[22px]',
].join(' ')

const utility4Class = [
  'post-entry grid grid-cols-[140px_minmax(0,_1fr)_40px] gap-8 items-center py-[26px] px-7 border',
].join(' ')

const utility5Class = ['hover:shadow-[0_8px_32px_var(--blog-shadow-hover)] [&:hover_.post-arrow]:bg-primary'].join(' ')

const utility6Class = [
  'post-title m-0 text-[length:22px] font-medium tracking-[-0.02em] leading-[1.3] wrap-anywhere',
].join(' ')

const utility7Class = [
  'post-arrow flex items-center justify-center w-10 h-10 rounded-full bg-muted',
  'text-muted-foreground',
].join(' ')

const utility8Class = ['[transition:background-color_0.2s,_color_0.2s,_transform_0.2s] max-[701px]:hidden'].join(' ')

const utility9Class = [
  'site-afterword flex items-center justify-between gap-6 pt-6 px-0 pb-[30px] border-t',
  'border-border',
].join(' ')

const utility10Class = [
  'post-description max-w-[62ch] mt-2 mx-0 mb-0 text-muted-foreground text-help leading-[1.75]',
].join(' ')

const layout1Class = [
  utility1Class,
  utility2Class,
  '[&_.empty-title]:mx-0 [&_.empty-title]:mb-[2px] [&_.empty-title]:text-foreground',
  utility3Class,
].join(' ')

const layout2Class = [
  utility4Class,
  'border-border rounded-[16px] bg-card text-inherit no-underline',
  '[transition:border-color_0.2s,_box-shadow_0.2s]',
  'hover:border-[color-mix(in_srgb,_var(--ztd-accent)_45%,_var(--ztd-border))]',
  utility5Class,
  '[&:hover_.post-arrow]:text-[var(--ztd-action-foreground)]',
  '[&:hover_.post-arrow]:transform-[translateX(2px)]',
  'max-[960px]:grid-cols-[120px_minmax(0,_1fr)_40px] max-[960px]:gap-6',
  'max-[701px]:grid-cols-[minmax(0,_1fr)] max-[701px]:gap-[10px] max-[701px]:p-5',
].join(' ')

const layout3Class = [
  'post-meta flex flex-col gap-[6px] text-muted-foreground text-help tabular-nums',
  'max-[701px]:flex-row max-[701px]:gap-3',
].join(' ')

const layout4Class = [utility6Class, 'max-[701px]:text-[length:19px]'].join(' ')

const layout5Class = [utility7Class, utility8Class].join(' ')

const layout6Class = [utility9Class, 'text-muted-foreground [&_p]:m-0 [&_p]:text-help'].join(' ')

export function PostList({
  items,
  start = 0,
}: {
  items: PublicItem[]
  start?: number
}): ReactNode {
  if (items.length === 0) {
    return (
      <div className={layout1Class}>
        <span
          className={[
            'empty-icon flex items-center justify-center w-11 h-11 rounded-[10px] bg-muted',
            'text-muted-foreground',
          ].join(' ')}
          aria-hidden="true"
        >
          <PenLine size={20} />
        </span>
        <div>
          <p className="empty-title"><SiteText value="No published posts yet." /></p>
          <p><SiteText value="New writing will appear here once it is published." /></p>
        </div>
      </div>
    )
  }
  return (
    <ol className="post-list grid gap-[14px] m-0 p-0 list-none">
      {items.map((post, index) => (
        <li key={post.documentId}>
          <Link href={post.path} className={layout2Class} aria-labelledby={`post-${post.documentId}`}>
            <span className={layout3Class}>
              <span className="collection-number text-accent-foreground text-help font-normal tabular-nums">
                {String(start + index + 1).padStart(2, '0')}
              </span>
              <SiteDate value={post.publishedAt} />
            </span>
            <div className="post-body min-w-0">
              <h3 className={layout4Class} id={`post-${post.documentId}`}>
                {post.title}
              </h3>
              {post.description !== '' && (
                <p className={[utility10Class, 'wrap-anywhere'].join(' ')}>
                  {post.description}
                </p>
              )}
            </div>
            <span className={layout5Class} aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

export function SiteAfterword(): ReactNode {
  return (
    <div className={layout6Class}>
      <p><SiteText value="Notes on building things." /></p>
      <a
        href="#top"
        className={[
          'back-top inline-flex items-center gap-[9px] min-h-11 text-help no-underline',
          'hover:text-foreground',
        ].join(' ')}
      >
        <SiteText value="Back to top" />
        <ArrowUp size={14} aria-hidden="true" />
      </a>
    </div>
  )
}
