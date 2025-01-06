import type { Author } from './types'
import AuthorLink from './AuthorLink'

export type AuthorListType = [Author] | [Author, Author] | [Author, Author, ...Author[]]

export interface AuthorListProps {
  authors: AuthorListType
}

export default function AuthorList({ authors }: AuthorListProps) {
  return (
    <div className="flex gap-2 text-sm text-stone-800">
      <AuthorLink {...authors[0]} />
      {
        authors.length > 1 && (
          <>
            <AuthorLink {...authors[1]!} />
            <span>
              and
              {' '}
              {authors.length - 1}
              {' '}
              more
            </span>
          </>
        )
      }
    </div>
  )
}
