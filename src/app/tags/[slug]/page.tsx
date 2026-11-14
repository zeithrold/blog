import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { tagUrl } from '@/contracts/notion'
import { PostList } from '@/features/reader/post-list'
import { PublicPageTitle } from '@/features/reader/public-page-title'
import { SiteCount, SiteText } from '@/i18n/site-text'
import { publishedCatalog } from '@/server/runtime/context'

export default async function TagArticles({ searchParams }: {
  readonly searchParams: Promise<{ offset?: string | string[] }>
}): Promise<ReactNode> {
  // App Router canonicalizes page params for segment state; preserve opaque IDs from the request.
  const path = z.string().parse((await headers()).get('x-blog-request-path'))
  const tagId = decodeURIComponent(path.slice('/tags/'.length))
  const { offset: rawOffset = '0' } = await searchParams
  if (typeof rawOffset !== 'string' || !/^(?:0|[1-9]\d*)$/.test(rawOffset)) {
    notFound()
  }
  const offset = Number(rawOffset)
  if (!Number.isSafeInteger(offset) || offset > 100000) {
    notFound()
  }
  const catalog = await publishedCatalog()
  const articles = catalog.items.filter(item =>
    item.path.startsWith('/posts/') && item.tags.some(tag => tag.id === tagId))
  const tag = articles[0]?.tags.find(option => option.id === tagId)
  if (tag === undefined) {
    notFound()
  }
  const nextOffset = offset + 50 < articles.length ? offset + 50 : null
  return (
    <>
      <header className="pt-14 pb-8 max-[701px]:pt-10">
        <Link className="inline-flex items-center min-h-11 mb-5 text-help no-underline hover:underline" href="/tags">
          <SiteText value="All tags" />
        </Link>
        <PublicPageTitle id="tag-heading">{tag.label}</PublicPageTitle>
        <p className="mt-5 mb-0 text-muted-foreground text-help tabular-nums">
          <SiteCount count={articles.length} one="1 post" other="{count} posts" />
        </p>
      </header>
      <section id="posts" className="pb-14 max-[701px]:pb-10" aria-labelledby="tag-posts-heading">
        <h2 id="tag-posts-heading" className="sr-only"><SiteText value="Writing" /></h2>
        <PostList items={articles.slice(offset, offset + 50)} start={offset} />
        {nextOffset !== null && (
          <Link
            className="inline-flex items-center min-h-11 mt-5 text-control no-underline hover:underline"
            href={`${tagUrl(tag.id)}?offset=${nextOffset}#posts`}
          >
            <SiteText value="Older posts" />
          </Link>
        )}
      </section>
    </>
  )
}
