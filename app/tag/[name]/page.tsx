import { PostList } from '@/components/blog/PostList'
import { Card, CardContent } from '@/components/ui/card'
import { fetchPosts } from '@/lib/notion/posts'

export const revalidate = 300

interface TagPageProps {
  params: Promise<{ name: string }>
  searchParams: Promise<{ start_cursor?: string }>
}

/**
 * Posts filtered by tag name.
 */
export default async function TagPage({ params, searchParams }: TagPageProps) {
  const { name } = await params
  const tag = decodeURIComponent(name)
  const { start_cursor: startCursor } = await searchParams

  try {
    const data = await fetchPosts({ tag, startCursor })
    return <PostList data={data} basePath={`/tag/${encodeURIComponent(tag)}`} />
  }
  catch {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="mx-auto max-w-md text-center">
          <CardContent className="py-8 text-muted-foreground">
            Tag not found.
          </CardContent>
        </Card>
      </div>
    )
  }
}
