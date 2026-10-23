import type { ReactNode } from 'react'
import { ArrowDown, ArrowRight, Search as SearchIcon } from 'lucide-react'
import Link from 'next/link'
import { Button, Input } from '@/components/ui/ztd-me/client'
import { SiteAfterword } from '@/features/reader/post-list'
import { PublicPageTitle } from '@/features/reader/public-page-title'
import { SiteCount, SiteText } from '@/i18n/site-text'
import { repository } from '@/server/runtime/context'
import {
  utility1Class,
  utility2Class,
  utility3Class,
  utility4Class,
  utility5Class,
  utility6Class,
  utility7Class,
  utility8Class,
  utility9Class,
  utility10Class,
  utility11Class,
  utility12Class,
  utility13Class,
  utility14Class,
  utility15Class,
  utility16Class,
  utility17Class,
  utility18Class,
  utility19Class,
  utility20Class,
  utility21Class,
  utility22Class,
  utility23Class,
  utility24Class,
} from './page-utilities'

const layout1Class = [
  'site-content w-[min(var(--blog-content-width),_calc(100%_-_96px))] my-0 mx-auto',
  'max-[960px]:w-[calc(100%_-_64px)] max-[701px]:w-[calc(100%_-_40px)]',
  'max-[360px]:w-[calc(100%_-_32px)]',
].join(' ')

const layout2Class = [
  utility1Class,
  utility2Class,
  'max-[701px]:pt-10 max-[701px]:px-0 max-[701px]:pb-8',
].join(' ')

const layout3Class = [
  utility3Class,
  'leading-[1.6] uppercase flex items-center gap-[10px] mt-0 mx-0 mb-[22px]',
].join(' ')

const layout5Class = [
  utility4Class,
  utility5Class,
  '[&_input]:min-w-0 [&_input]:pl-10 [&_input]:border-0 [&_input]:bg-transparent',
  '[&_input]:text-editable [&_input:focus-visible]:[outline:none]',
].join(' ')

const layout6Class = [utility6Class, 'whitespace-nowrap border-0'].join(' ')

const layout7Class = [utility7Class, 'transform-[translateY(-50%)]'].join(' ')

const layout8Class = [
  'button-primary border-primary bg-primary text-[var(--ztd-action-foreground)]',
  '[&:hover:not(:disabled)]:border-primary',
  '[&:hover:not(:disabled)]:bg-[color-mix(in_srgb,_var(--ztd-action)_84%,_var(--ztd-background))]',
].join(' ')

const layout9Class = [
  'collection-heading flex justify-between items-center gap-5 mb-[18px] [&_h2]:flex',
  utility8Class,
].join(' ')

const layout10Class = [
  utility9Class,
  utility10Class,
  '[&:hover_svg]:transform-[translateY(2px)]',
].join(' ')

const layout11Class = [
  utility11Class,
  utility12Class,
  utility13Class,
  utility14Class,
  utility15Class,
].join(' ')

const layout12Class = [utility16Class, 'max-[701px]:text-[length:19px]'].join(' ')

const layout13Class = [utility17Class, utility18Class].join(' ')

const layout14Class = [
  utility19Class,
  utility20Class,
  '[&_.empty-title]:mx-0 [&_.empty-title]:mb-[2px] [&_.empty-title]:text-foreground',
  utility21Class,
].join(' ')

type SearchResult = Awaited<ReturnType<ReturnType<typeof repository>['search']>>

export default async function Search({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    offset?: string
  }>
}): Promise<ReactNode> {
  const { q = '', offset: rawOffset } = await searchParams
  const offset = Number(rawOffset ?? 0)
  const result = await repository().search(q, offset)
  return (
    <div className={layout1Class} id="top">
      <SearchIntro query={q} />
      <SearchResults query={q} offset={offset} result={result} />
      <SiteAfterword />
    </div>
  )
}

function SearchIntro({ query }: { query: string }): ReactNode {
  return (
    <section className={layout2Class} aria-labelledby="search-heading">
      <p className={layout3Class}>
        <SearchIcon className="intro-mark text-accent-foreground" size={16} aria-hidden="true" />
        <SiteText value="Search" />
      </p>
      <PublicPageTitle id="search-heading"><SiteText value="Search published writing" /></PublicPageTitle>
      <p className={utility22Class}><SiteText value="Find posts by title or text." /></p>
      <form action="/search" role="search" className={layout5Class}>
        <label htmlFor="search-query" className={layout6Class}>
          <SiteText value="Search terms" />
        </label>
        <SearchIcon className={layout7Class} size={18} aria-hidden="true" />
        <Input id="search-query" name="q" type="search" maxLength={120} defaultValue={query} />
        <Button type="submit" className={layout8Class}>
          <SiteText value="Search" />
        </Button>
      </form>
    </section>
  )
}

function SearchResults({
  query,
  offset,
  result,
}: {
  query: string
  offset: number
  result: SearchResult
}): ReactNode {
  const complete = result.items.length > 0 && offset === 0 && result.nextOffset === null
  return (
    <section className="collection pb-14" aria-labelledby="results-heading">
      <div className={layout9Class}>
        <h2 id="results-heading">
          <span className="collection-number text-accent-foreground text-help font-normal tabular-nums">01</span>
          <SiteText value="Results" />
        </h2>
        {complete && (
          <span className="collection-count text-muted-foreground text-help">
            <SiteCount count={result.items.length} one="1 result" other="{count} results" />
          </span>
        )}
      </div>
      {result.items.length > 0
        ? <ResultList items={result.items} />
        : <NoResults searched={query.trim() !== ''} />}
      {result.nextOffset !== null && (
        <a
          className={layout10Class}
          href={`/search?q=${encodeURIComponent(query)}&offset=${result.nextOffset}`}
        >
          <SiteText value="More results" />
          <ArrowDown size={15} aria-hidden="true" />
        </a>
      )}
    </section>
  )
}

function ResultList({ items }: { items: SearchResult['items'] }): ReactNode {
  return (
    <ol className="post-list grid m-0 p-0 list-none border-b border-border">
      {items.map(item => (
        <li key={item.path}>
          <Link href={item.path} className={layout11Class}>
            <div className="post-body min-w-0">
              <h3 className={layout12Class}>
                {item.title}
              </h3>
              <p className={[utility23Class, 'wrap-anywhere'].join(' ')}>
                {item.excerpt}
              </p>
              <span className={utility24Class}>{item.path}</span>
            </div>
            <span className={layout13Class} aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

function NoResults({ searched }: { searched: boolean }): ReactNode {
  return (
    <div className={layout14Class}>
      <span
        className={[
          'empty-icon flex items-center justify-center w-11 h-11 rounded-[10px] bg-muted',
          'text-muted-foreground',
        ].join(' ')}
        aria-hidden="true"
      >
        <SearchIcon size={20} />
      </span>
      <div>
        <p className="empty-title">
          <SiteText value={searched ? 'No results.' : 'Enter a word or phrase to search.'} />
        </p>
        {searched && <p><SiteText value="Try a shorter phrase or different words." /></p>}
      </div>
    </div>
  )
}
