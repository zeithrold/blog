import type { ReactNode } from 'react'
import { ArrowDown, Asterisk, Rss } from 'lucide-react'
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
  'intro flex justify-between items-end gap-12 pt-18 px-0 pb-16',
  '[&_h1_>_span]:text-muted-foreground',
].join(' ')

const utility5Class = [
  'max-[960px]:gap-8 max-[960px]:pt-14 max-[960px]:px-0 max-[960px]:pb-13 max-[701px]:block',
].join(' ')

const utility6Class = [
  'eyebrow intro-eyebrow m-0 text-muted-foreground text-help font-medium tracking-[0.14em]',
].join(' ')

const utility7Class = [
  '[&_p]:text-muted-foreground [&_p]:text-help [&_p]:leading-[1.85] max-[960px]:w-[250px]',
].join(' ')

const utility8Class = [
  'intro-links flex flex-col items-start [&_a]:inline-flex [&_a]:items-center [&_a]:gap-[10px]',
].join(' ')

const utility9Class = [
  '[&_a]:min-h-11 [&_a]:text-help [&_a]:font-medium [&_a]:no-underline',
  '[&_svg]:text-accent-foreground',
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
  'max-[701px]:pt-11 max-[701px]:px-0 max-[701px]:pb-10',
].join(' ')

const layout5Class = [
  utility6Class,
  'leading-[1.6] uppercase flex items-center gap-[10px] mt-0 mx-0 mb-[22px]',
].join(' ')

const layout6Class = [
  'm-0 text-[clamp(44px,6vw,68px)] font-medium tracking-[-0.045em] leading-[1.08]',
  '[html:lang(zh-CN)_&]:tracking-[-0.02em] [html:lang(zh-CN)_&]:leading-[1.2]',
].join(' ')

const layout7Class = [
  'intro-aside shrink-0 w-[290px] pb-[6px] [&_p]:mt-0 [&_p]:mx-0 [&_p]:mb-[18px]',
  utility7Class,
  'max-[701px]:w-auto max-[701px]:max-w-90 max-[701px]:mt-6',
].join(' ')

const layout8Class = [
  utility8Class,
  utility9Class,
  '[&_svg]:[transition:transform_0.2s] [&_a:hover]:text-accent-foreground',
  '[&_a:hover_svg]:transform-[translateY(2px)]',
].join(' ')

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    offset?: string
  }>
}): Promise<ReactNode> {
  const query = await searchParams
  const offset = Number(query.offset ?? 0)
  const posts = await repository().posts(offset)
  return (
    <div className={layout1Class} id="top">
      <HomeIntro />
      <section id="posts" className="collection pb-14" aria-labelledby="posts-heading">
        <div className={layout2Class}>
          <h2 id="posts-heading">
            <span className="collection-number text-accent-foreground text-help font-normal tabular-nums">01</span>
            <SiteText value="Latest writing" />
          </h2>
          <span className="collection-count text-muted-foreground text-help">
            {posts.items.length > 0 && offset === 0 && posts.nextOffset === null
              ? <SiteCount count={posts.items.length} one="1 post" other="{count} posts" />
              : <SiteText value="In reverse chronological order" />}
          </span>
        </div>
        <PostList items={posts.items} start={offset} />
        {posts.nextOffset !== null && (
          <a className={layout3Class} href={`/?offset=${posts.nextOffset}#posts`}>
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
    <section className={layout4Class} aria-labelledby="intro-heading">
      <div>
        <p className={layout5Class}>
          <Asterisk className="intro-mark text-accent-foreground" size={20} aria-hidden="true" />
          <SiteText value="Notes & ideas" />
        </p>
        <h1 className={layout6Class} id="intro-heading">
          <SiteText value="Ahead every" />
          <br />
          <span><SiteText value="moment." /></span>
        </h1>
      </div>
      <div className={layout7Class}>
        <p><SiteText value="Writing about software, systems, and things worth understanding." /></p>
        <div className={layout8Class}>
          <a href="#posts">
            <SiteText value="Browse writing" />
            <ArrowDown size={15} aria-hidden="true" />
          </a>
          <a href="/rss.xml">
            <Rss size={14} aria-hidden="true" />
            <SiteText value="Subscribe via RSS" />
          </a>
        </div>
      </div>
    </section>
  )
}
