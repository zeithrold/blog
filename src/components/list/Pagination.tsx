import Link from 'next/link'

export interface PaginationProps {
  currentPage: number
  pageCount: number
}

export default function Pagination(
  {
    currentPage,
    pageCount,
  }: PaginationProps,
) {
  const start = currentPage < 3 ? 1 : currentPage - 2
  const end = start + 4 > pageCount ? pageCount : start + 4
  const length = end - start + 1

  return (
    <div className="join">
      {
        start > 1 && (
          <Link
            className="btn join-item btn-xm"
            href={(start - 1 === 1) ? '/' : `/page/${start - 1}`}
          >
            Prev
          </Link>
        )
      }
      {
        Array.from({ length }, (_, i) => (
          <Link
            key={`pagination-${i + start}`}
            href={(i + start === 1) ? '/' : `/page/${i + start}`}
            className={`
              btn join-item btn-xm

              ${currentPage === i + start
            ? `btn-active`
            : ''}
            `}
          >
            {i + start}
          </Link>
        ))
      }
      {
        end < pageCount && (
          <Link
            className="btn join-item btn-xm"
            href={`/page/${end + 1}`}
          >
            Next
          </Link>
        )
      }
    </div>
  )
}
