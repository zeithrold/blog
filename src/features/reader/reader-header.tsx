'use client'

import type { ReactNode } from 'react'
import type { PublicItem } from '@/contracts/notion'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useSiteLocale, useSiteText } from '@/i18n/site-locale'
import { SiteDate } from '@/i18n/site-text'
import { TagChip } from './tag-chip'

const headerClass = 'reader-header mb-10 pb-8 border-b border-border'
const backClass = [
  'back-link inline-flex items-center gap-2 min-h-11 text-muted-foreground text-help font-medium',
  'mt-0 mr-0 mb-5 ml-[-2px] no-underline hover:text-foreground',
  '[&_svg]:[transition:transform_0.2s] [&:hover_svg]:transform-[translateX(-2px)]',
].join(' ')
const metaClass = [
  'eyebrow reader-eyebrow m-0 text-muted-foreground text-help font-medium tracking-[0.14em]',
  'leading-[1.6] uppercase flex flex-wrap items-center gap-y-1 gap-x-[14px] mb-5',
].join(' ')
const titleClass = [
  'm-0 font-sans text-[clamp(44px,6vw,68px)] font-bold tracking-[-0.045em] leading-[1.08]',
  '[html:lang(zh-CN)_&]:tracking-[-0.02em] [html:lang(zh-CN)_&]:leading-[1.2]',
].join(' ')

export function ReaderHeader({ item }: { readonly item: PublicItem }): ReactNode {
  const text = useSiteText()
  const locale = useSiteLocale()
  const isPost = item.path.startsWith('/posts/')
  return (
    <header className={headerClass}>
      {isPost && (
        <Link className={backClass} href="/" lang={locale}>
          <ArrowLeft size={15} aria-hidden="true" />
          {text('All writing')}
        </Link>
      )}
      <p className={metaClass} lang={locale}>
        <span className="reader-kind text-accent-foreground">{text(isPost ? 'Article' : 'Page')}</span>
        <SiteDate value={item.publishedAt} />
        {item.updatedAt - item.publishedAt > 86_400_000 && (
          <span>
            {text('Updated')}
            {' '}
            <SiteDate value={item.updatedAt} />
          </span>
        )}
      </p>
      <h1 className={titleClass}>{item.title}</h1>
      {item.summary !== '' && <p className="description">{item.summary}</p>}
      {item.tags.length > 0 && (
        <div className="reader-tags flex flex-wrap gap-2 mt-6" aria-label={text('Tags')}>
          {item.tags.map(tag => <TagChip key={tag.id} tag={tag} />)}
        </div>
      )}
    </header>
  )
}
