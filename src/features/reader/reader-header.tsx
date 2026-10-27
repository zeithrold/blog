'use client'
import type { ReactNode } from 'react'
import type { Document } from '@/content/document'
import { ArrowLeft, Hash, Layers } from 'lucide-react'
import { useSiteLocale, useSiteText } from '@/i18n/site-locale'
import { SiteDate } from '@/i18n/site-text'

const utility1Class = [
  'reader-header mb-10 pb-8 border-b border-border [&_.back-link]:mt-0 [&_.back-link]:mr-0',
].join(' ')

const utility2Class = [
  'back-link inline-flex items-center gap-2 min-h-11 text-muted-foreground text-help font-medium',
].join(' ')

const utility3Class = [
  'eyebrow reader-eyebrow m-0 text-muted-foreground text-help font-medium tracking-[0.14em]',
].join(' ')

const utility4Class = [
  'taxonomy-chip relative inline-flex items-center gap-[6px] min-h-[34px] py-0 px-3 border',
].join(' ')

const utility5Class = [
  'border-border rounded-full bg-card text-muted-foreground text-help leading-[1.2] no-underline',
].join(' ')

const utility6Class = [
  'hover:border-[color-mix(in_srgb,_var(--ztd-accent)_50%,_var(--ztd-border))]',
  'hover:text-foreground',
].join(' ')

const utility7Class = [
  'taxonomy-chip relative inline-flex items-center gap-[6px] min-h-[34px] py-0 px-3 border',
].join(' ')

const utility8Class = [
  'border-border rounded-full bg-card text-muted-foreground text-help leading-[1.2] no-underline',
].join(' ')

const utility9Class = [
  'hover:border-[color-mix(in_srgb,_var(--ztd-accent)_50%,_var(--ztd-border))]',
  'hover:text-foreground',
].join(' ')

const layout1Class = [utility1Class, '[&_.back-link]:mb-5 [&_.back-link]:ml-[-2px]'].join(' ')

const layout2Class = [
  utility2Class,
  'no-underline hover:text-foreground [&_svg]:[transition:transform_0.2s]',
  '[&:hover_svg]:transform-[translateX(-2px)]',
].join(' ')

const layout3Class = [
  utility3Class,
  'leading-[1.6] uppercase flex flex-wrap items-center gap-y-1 gap-x-[14px] mb-5',
].join(' ')

const layout4Class = [
  'm-0 text-[clamp(44px,6vw,68px)] font-medium tracking-[-0.045em] leading-[1.08]',
  '[html:lang(zh-CN)_&]:tracking-[-0.02em] [html:lang(zh-CN)_&]:leading-[1.2]',
].join(' ')

const layout5Class = [
  utility4Class,
  utility5Class,
  '[transition:border-color_0.2s,_color_0.2s]',
  utility6Class,
  '[&_svg]:text-accent-foreground',
].join(' ')

const layout6Class = [
  utility7Class,
  utility8Class,
  '[transition:border-color_0.2s,_color_0.2s]',
  utility9Class,
  '[&_svg]:text-accent-foreground',
].join(' ')

export type Publication = {
  kind: 'posts' | 'pages'
  publishedAt: number
  updatedAt: number
}

const DAY = 86400000

export function ReaderHeader({
  meta,
  publication,
}: {
  meta: Document['meta']
  publication?: Publication
}): ReactNode {
  const text = useSiteText()
  const locale = useSiteLocale()
  return (
    <header className={layout1Class}>
      {publication?.kind === 'posts' && (
        <a className={layout2Class} href="/" lang={locale}>
          <ArrowLeft size={15} aria-hidden="true" />
          {text('All writing')}
        </a>
      )}
      {publication !== undefined && (
        <p className={layout3Class} lang={locale}>
          <span className="reader-kind text-accent-foreground">
            {text(publication.kind === 'posts' ? 'Article' : 'Page')}
          </span>
          <SiteDate value={publication.publishedAt} />
          {publication.updatedAt - publication.publishedAt > DAY && (
            <span>
              {text('Updated')}
              {' '}
              <SiteDate value={publication.updatedAt} />
            </span>
          )}
        </p>
      )}
      <h1 className={layout4Class}>{meta.title}</h1>
      {meta.description !== '' && <p className="description">{meta.description}</p>}
      {meta.tags.length + meta.series.length > 0 && (
        <nav className="reader-taxonomy flex flex-wrap gap-2 mt-6" aria-label={text('Tags and series')}>
          {meta.series.map(series => (
            <a key={series.id} href={`/series/${series.slug}`} className={layout5Class}>
              <Layers size={13} aria-hidden="true" />
              {series.title}
            </a>
          ))}
          {meta.tags.map(tag => (
            <a
              key={tag.id}
              href={`/tags/${tag.slug}`}
              className={`${layout6Class} tag-color`}
              data-tag-color={tag.color ?? 'neutral'}
            >
              <Hash size={13} aria-hidden="true" />
              {tag.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}
