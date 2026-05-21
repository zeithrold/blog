import type { ListResponse } from '@/lib/types/posts'
import { PostCard } from './PostCard'
import { PostListPagination } from './PostListPagination'
import { Tag } from './Tag'

interface PostListProps {
  data: ListResponse
  basePath?: string
}

/**
 * Paginated post grid with optional tag filter banner.
 */
export function PostList({ data, basePath = '/' }: PostListProps) {
  return (
    <div className="container mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-4">
      {data.tag && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-xl font-medium">
          <span>Showing results for tag:</span>
          <Tag {...data.tag} className="h-7 px-2.5 text-xl" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.pages.map(item => (
          <PostCard key={item.id} {...item} />
        ))}
      </div>
      <PostListPagination
        hasMore={data.has_more}
        nextCursor={data.next_cursor}
        basePath={basePath}
      />
    </div>
  )
}
