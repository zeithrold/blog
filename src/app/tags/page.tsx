import type { ReactNode } from 'react'
import type { PublicTag } from '@/contracts/notion'
import { PublicPageTitle } from '@/features/reader/public-page-title'
import { TagChip } from '@/features/reader/tag-chip'
import { SiteCount, SiteText } from '@/i18n/site-text'
import { publishedCatalog } from '@/server/runtime/context'

export default async function Tags(): Promise<ReactNode> {
  const catalog = await publishedCatalog()
  const tags = new Map<string, { readonly tag: PublicTag, count: number }>()
  for (const item of catalog.items) {
    if (!item.path.startsWith('/posts/')) {
      continue
    }
    for (const tag of item.tags) {
      const entry = tags.get(tag.id)
      if (entry === undefined) {
        tags.set(tag.id, { tag, count: 1 })
      }
      else {
        entry.count += 1
      }
    }
  }
  return (
    <section className="pt-14 pb-14 max-[701px]:pt-10 max-[701px]:pb-10" aria-labelledby="tags-heading">
      <PublicPageTitle id="tags-heading"><SiteText value="Tags" /></PublicPageTitle>
      <p className="mt-5 mb-8 text-muted-foreground text-body">
        <SiteText value="Browse published articles by tag." />
      </p>
      {tags.size === 0
        ? <p><SiteText value="No tags on published articles yet." /></p>
        : (
            <ul className="flex flex-wrap gap-x-8 gap-y-5 m-0 p-0 list-none">
              {Array.from(tags.values(), ({ tag, count }) => (
                <li key={tag.id} className="flex max-w-full flex-wrap items-center gap-3">
                  <TagChip tag={tag} />
                  <span className="text-muted-foreground text-help tabular-nums">
                    <SiteCount count={count} one="1 post" other="{count} posts" />
                  </span>
                </li>
              ))}
            </ul>
          )}
    </section>
  )
}
