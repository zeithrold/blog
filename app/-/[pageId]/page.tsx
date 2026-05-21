import { notFound } from 'next/navigation'
import { ArticleCover, PostHeader } from '@/components/blog/PostHeader'
import { NotionPage } from '@/components/notion/NotionPage'
import { getPageRecordMap } from '@/lib/notion/client'
import { getPageMeta } from '@/lib/notion/posts'
import { cn } from '@/lib/utils'

export const revalidate = 300

interface PostPageProps {
  params: Promise<{ pageId: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 *
 */
export async function generateMetadata({ params }: PostPageProps) {
  const { pageId } = await params
  if (!UUID_RE.test(pageId))
    return { title: 'Not Found' }
  try {
    const meta = await getPageMeta(pageId)
    return { title: meta.title }
  }
  catch {
    return { title: 'Not Found' }
  }
}

/**
 *
 */
export default async function PostPage({ params }: PostPageProps) {
  const { pageId } = await params
  if (!UUID_RE.test(pageId))
    notFound()

  try {
    const [
      recordMap,
      meta,
    ] = await Promise.all([
      getPageRecordMap(pageId),
      getPageMeta(pageId),
    ])

    const cover = meta.cover
    const hasCover = cover != null && cover !== ''

    return (
      <div className="flex flex-col">
        {hasCover && <ArticleCover src={cover} alt={meta.title} />}
        <div
          className={cn(
            'container mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-4',
            hasCover ? 'pt-6' : 'py-4',
          )}
        >
          <PostHeader {...meta} />
          <NotionPage recordMap={recordMap} />
        </div>
      </div>
    )
  }
  catch {
    notFound()
  }
}
