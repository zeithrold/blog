import type { ReactNode } from 'react'
import { ArrowDown, Asterisk, Rss } from 'lucide-react'
import { PostFeed } from '@/features/reader/post-feed'
import { SiteAfterword } from '@/features/reader/post-list'
import { SiteCount, SiteText } from '@/i18n/site-text'
import { repository } from '@/server/runtime/context'

const siteContentStyle1 = [
  'site-content w-[min(var(--blog-content-width),_calc(100%_-_96px))] mx-auto',
  'max-[960px]:w-[calc(100%_-_64px)] max-[701px]:w-[calc(100%_-_40px)]',
  'max-[360px]:w-[calc(100%_-_32px)]',
].join(' ')

const collectionHeadingStyle2 = [
  'collection-heading flex flex-wrap justify-between items-center gap-x-5 gap-y-2 mb-5',
].join(' ')

const collectionNumberStyle3 = [
  'collection-number text-accent-foreground text-help font-normal font-mono tabular-nums',
].join(' ')

const moreLinkStyle4 = [
  'more-link mt-5 inline-flex items-center gap-3 min-h-11 text-control font-medium no-underline',
  'hover:text-accent-foreground',
].join(' ')

const introStyle5 = [
  'intro grid grid-cols-[1fr_280px] items-end gap-12 pt-14 pb-14 max-[960px]:gap-8',
  'max-[701px]:grid-cols-1 max-[701px]:gap-6 max-[701px]:pt-10 max-[701px]:pb-10',
].join(' ')

const eyebrowStyle6 = [
  'eyebrow intro-eyebrow flex items-center gap-2.5 m-0 mb-5 text-muted-foreground text-help',
  'font-medium tracking-[.13em] uppercase',
].join(' ')

const layoutStyle7 = [
  'm-0 font-serif text-[length:clamp(38px,3.6vw,50px)] font-medium tracking-[-.04em] leading-[1.2]',
  'text-balance max-[701px]:text-[length:clamp(32px,8.5vw,36px)]',
  '[html:lang(zh-CN)_&]:tracking-[-.02em] [html:lang(zh-CN)_&]:leading-[1.35]',
].join(' ')

const introAsideStyle8 = [
  'intro-aside min-w-0 max-w-90 [&_p]:m-0 [&_p]:mb-3 [&_p]:text-muted-foreground [&_p]:text-body',
  '[&_p]:leading-[1.85]',
].join(' ')

const introLinksStyle9 = [
  'intro-links flex flex-wrap items-center gap-x-5 [&_a]:inline-flex [&_a]:items-center [&_a]:gap-2',
  '[&_a]:min-h-11 [&_a]:text-control [&_a]:no-underline [&_a:hover]:text-accent-foreground',
].join(' ')

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>
}): Promise<ReactNode> {
  const query = await searchParams
  const offset = Number(query.offset ?? 0)
  const posts = await repository().posts(offset)
  return (
    <div className={siteContentStyle1} id="top">
      <HomeIntro />
      <section id="posts" className="collection pb-14 max-[701px]:pb-10" aria-labelledby="posts-heading">
        <div className={collectionHeadingStyle2}>
          <h2 id="posts-heading" className="flex items-center gap-3 m-0 text-control font-semibold">
            <span className={collectionNumberStyle3}>01</span>
            <SiteText value="Latest writing" />
          </h2>
          <span className="collection-count text-muted-foreground text-help">
            {posts.items.length > 0 && offset === 0 && posts.nextOffset === null
              ? <SiteCount count={posts.items.length} one="1 post" other="{count} posts" />
              : <SiteText value="In reverse chronological order" />}
          </span>
        </div>
        <PostFeed items={posts.items} start={offset} />
        {posts.nextOffset !== null && (
          <a className={moreLinkStyle4} href={`/?offset=${posts.nextOffset}#posts`}>
            <SiteText value="Older posts" />
            <ArrowDown size={15} aria-hidden="true" />
          </a>
        )}
      </section>
      <SiteAfterword />
    </div>
  )
}

function HomeIntro(): ReactNode {
  return (
    <section className={introStyle5} aria-labelledby="intro-heading">
      <div>
        <p className={eyebrowStyle6}>
          <Asterisk className="intro-mark text-accent-foreground" size={17} aria-hidden="true" />
          <SiteText value="Notes & ideas" />
        </p>
        <h1 className={layoutStyle7} id="intro-heading">
          <SiteText value="Ahead every" />
          <br />
          <span className="text-muted-foreground"><SiteText value="moment." /></span>
        </h1>
      </div>
      <div className={introAsideStyle8}>
        <p><SiteText value="Writing about software, systems, and things worth understanding." /></p>
        <div className={introLinksStyle9}>
          <a href="#posts">
            <SiteText value="Browse writing" />
            <ArrowDown size={14} aria-hidden="true" />
          </a>
          <a href="/rss.xml">
            <Rss size={13} aria-hidden="true" />
            <SiteText value="Subscribe via RSS" />
          </a>
        </div>
      </div>
    </section>
  )
}
