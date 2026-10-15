import type { ReactNode } from 'react'
import { ArrowDown, ArrowLeft, Hash, Layers } from 'lucide-react'
import { notFound } from 'next/navigation'
import { SLUG } from '@/content/document'
import { PostList, SiteAfterword } from '@/features/reader/post-list'
import { SiteCount, SiteText } from '@/i18n/site-text'
import { repository } from '@/server/context'

const utility1Class = [
  '[&_h2]:items-center [&_h2]:gap-3 [&_h2]:m-0 [&_h2]:text-[length:15px] [&_h2]:font-semibold',
].join(' ')

const utility2Class = [
  'more-link mt-4 inline-flex items-center gap-[10px] min-h-11 text-help font-medium no-underline',
].join(' ')

const utility3Class = [
  '[&_svg]:text-accent-foreground [&_svg]:[transition:transform_0.2s]',
  'hover:text-accent-foreground',
].join(' ')

const utility4Class = [
  'page-intro max-w-190 pt-14 px-0 pb-11 [&_.back-link]:mt-0 [&_.back-link]:mr-0',
  '[&_.back-link]:mb-5',
].join(' ')

const utility5Class = [
  '[&_.back-link]:ml-[-2px] [&_h1]:text-[length:clamp(36px,_5vw,_54px)] [&_h1]:wrap-anywhere',
].join(' ')

const utility6Class = [
  'back-link inline-flex items-center gap-2 min-h-11 text-muted-foreground text-help font-medium',
].join(' ')

const utility7Class = [
  'eyebrow intro-eyebrow m-0 text-muted-foreground text-help font-medium tracking-[0.14em]',
].join(' ')

const layout1Class = [
  'site-content w-[min(var(--blog-content-width),_calc(100%_-_96px))] my-0 mx-auto',
  'max-[960px]:w-[calc(100%_-_64px)] max-[701px]:w-[calc(100%_-_40px)]',
  'max-[360px]:w-[calc(100%_-_32px)]',
].join(' ')

const layout2Class = [
  'collection-heading flex justify-between items-center gap-5 mb-[18px] [&_h2]:flex',
  utility1Class,
].join(' ')

const layout3Class = [
  utility2Class,
  utility3Class,
  '[&:hover_svg]:transform-[translateY(2px)]',
].join(' ')

const layout4Class = [
  utility4Class,
  utility5Class,
  'max-[701px]:pt-10 max-[701px]:px-0 max-[701px]:pb-8',
].join(' ')

const layout5Class = [
  utility6Class,
  'no-underline hover:text-foreground [&_svg]:[transition:transform_0.2s]',
  '[&:hover_svg]:transform-[translateX(-2px)]',
].join(' ')

const layout6Class = [
  utility7Class,
  'leading-[1.6] uppercase flex items-center gap-[10px] mt-0 mx-0 mb-[22px]',
].join(' ')

const layout7Class = [
  'm-0 text-[clamp(44px,6vw,68px)] font-medium tracking-[-0.045em] leading-[1.08]',
  '[html:lang(zh-CN)_&]:tracking-[-0.02em] [html:lang(zh-CN)_&]:leading-[1.2]',
].join(' ')

export async function TaxonomyPage({
  kind,
  params,
  searchParams,
}: {
  kind: 'tag' | 'series'
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    offset?: string
  }>
}): Promise<ReactNode> {
  const { slug } = await params
  if (!SLUG.safeParse(slug).success) {
    notFound()
  }
  const query = await searchParams
  const offset = Number(query.offset ?? 0)
  const result = await repository().taxonomy(kind, slug, offset)
  if (result === null) {
    notFound()
  }
  return (
    <div className={layout1Class} id="top">
      <TaxonomyIntro kind={kind} label={result.label} />
      <section className="collection pb-14" aria-labelledby="taxonomy-posts">
        <div className={layout2Class}>
          <h2 id="taxonomy-posts">
            <span className="collection-number text-accent-foreground text-help font-normal tabular-nums">01</span>
            <SiteText value="Writing" />
          </h2>
          {offset === 0 && result.nextOffset === null && (
            <span className="collection-count text-muted-foreground text-help">
              <SiteCount count={result.items.length} one="1 post" other="{count} posts" />
            </span>
          )}
        </div>
        <PostList items={result.items} start={offset} />
        {result.nextOffset !== null && (
          <a
            className={layout3Class}
            href={`/${kind === 'tag' ? 'tags' : 'series'}/${slug}?offset=${result.nextOffset}`}
          >
            <SiteText value="More posts" />
            <ArrowDown size={15} aria-hidden="true" />
          </a>
        )}
      </section>
      <SiteAfterword />
    </div>
  )
}

function TaxonomyIntro({ kind, label }: { kind: 'tag' | 'series', label: string }): ReactNode {
  const Icon = kind === 'tag' ? Hash : Layers
  return (
    <section className={layout4Class} aria-labelledby="taxonomy-heading">
      <a className={layout5Class} href="/">
        <ArrowLeft size={15} aria-hidden="true" />
        <SiteText value="All writing" />
      </a>
      <p className={layout6Class}>
        <Icon className="intro-mark text-accent-foreground" size={16} aria-hidden="true" />
        <SiteText value={kind === 'tag' ? 'Tag' : 'Series'} />
      </p>
      <h1 className={layout7Class} id="taxonomy-heading">{label}</h1>
    </section>
  )
}
