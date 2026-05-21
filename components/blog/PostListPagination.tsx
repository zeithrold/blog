import { ButtonLink } from '@/components/ui/button'

interface PostListPaginationProps {
  hasMore: boolean
  nextCursor: string | null | undefined
  basePath: string
}

/**
 * Next-page link when the list response includes a cursor.
 */
export function PostListPagination({ hasMore, nextCursor, basePath }: PostListPaginationProps) {
  if (!hasMore || nextCursor == null || nextCursor === '')
    return null

  const nextHref = `${basePath}?start_cursor=${nextCursor}`

  return (
    <div className="flex justify-center p-2">
      <ButtonLink href={nextHref}>
        Next Page
      </ButtonLink>
    </div>
  )
}
