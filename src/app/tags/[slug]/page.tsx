import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { tagUrl } from '@/contracts/notion'
import { PostList } from '@/features/reader/post-list'
import { PublicPageTitle } from '@/features/reader/public-page-title'
import { SiteCount, SiteText } from '@/i18n/site-text'
import { listingMetadata, paginate } from '@/server/reader/listings'
import { publishedCatalog } from '@/server/runtime/context'

type TagProps = { readonly searchParams: Promise<{ offset?: string | string[] }> }

async function tagPosts(searchParams: TagProps['searchParams']) {
  // App Router canonicalizes page params for segment state; preserve opaque IDs from the request.
  const path = z.string().parse((await headers()).get('x-blog-request-path'))
  const tagId = decodeURIComponent(path.slice('/tags/'.length))
  const { offset } = await searchParams
  const catalog = await publishedCatalog()
  const articles = catalog.items.filter(item =>
    item.path.startsWith('/posts/') && item.tags.some(tag => tag.id === tagId))
  const tag = articles[0]?.tags.find(option => option.id === tagId)
  if (tag === undefined) {
    notFound()
  }
  return { tag, count: articles.length, ...paginate(articles, offset) }
}

export async function generateMetadata({ searchParams }: TagProps): Promise<Metadata> {
  const { tag, offset } = await tagPosts(searchParams)
  return listingMetadata(
    tagUrl(tag.id),
    `${tag.label} articles`,
    `Published articles tagged ${tag.label} on zeithrold/blog.`,
    offset,
  )
}

export default async function TagArticles({ searchParams }: TagProps): Promise<ReactNode> {
  const { tag, count, items, offset, nextOffset } = await tagPosts(searchParams)
  return (
    <>
      <header className="pt-14 pb-8 max-[701px]:pt-10">
        <Link className="inline-flex items-center min-h-11 mb-5 text-help no-underline hover:underline" href="/tags">
          <SiteText value="All tags" />
        </Link>
        <PublicPageTitle id="tag-heading">{tag.label}</PublicPageTitle>
        <p className="mt-5 mb-0 text-muted-foreground text-help tabular-nums">
          <SiteCount count={count} one="1 post" other="{count} posts" />
        </p>
      </header>
      <section id="posts" className="pb-14 max-[701px]:pb-10" aria-labelledby="tag-posts-heading">
        <h2 id="tag-posts-heading" className="sr-only"><SiteText value="Writing" /></h2>
        <PostList items={items} start={offset} />
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
