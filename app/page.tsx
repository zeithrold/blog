import { Identity } from '@/components/blog/Identity'
import { PostList } from '@/components/blog/PostList'
import { fetchPosts } from '@/lib/notion/posts'

export const revalidate = 300

interface HomePageProps {
  searchParams: Promise<{ start_cursor?: string }>
}

/**
 * Home page with identity hero and paginated post list.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const { start_cursor: startCursor } = await searchParams
  const data = await fetchPosts({ startCursor })

  return (
    <div className="flex flex-1 flex-col">
      <Identity />
      <PostList data={data} />
    </div>
  )
}
