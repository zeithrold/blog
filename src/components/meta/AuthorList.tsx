import type { AuthorListType } from './types'
import { BiUserCircle } from 'react-icons/bi'
import AuthorLink from './AuthorLink'

export interface AuthorListProps {
  authors: AuthorListType
  mode?: 'full' | 'compact'
}

function AuthorListCompact({ authors }: AuthorListProps) {
  return (
    <>
      <AuthorLink {...authors[0]} />
      {
        authors.length > 2 && (
          <>
            <AuthorLink {...authors[1]!} />
            <span>
              and
              {' '}
              {authors.length - 2}
              {' '}
              more
            </span>
          </>
        )
      }
    </>
  )
}

function AuthorListFull({ authors }: AuthorListProps) {
  return (
    <>
      {
        authors.map(author => (
          <AuthorLink {...author} key={author.username} />
        ))
      }
    </>
  )
}

export default function AuthorList({ authors, mode = 'compact' }: AuthorListProps) {
  return (
    <div className={`
      flex items-center gap-2

      ${mode === 'compact' ? 'text-sm' : ''}

      text-gray-600
    `}
    >
      <BiUserCircle className={`
        ${mode === 'full' ? 'text-lg' : ''}
      `}
      />
      <div className="flex flex-1 gap-2">
        {
          mode === 'compact'
            ? <AuthorListCompact authors={authors} />
            : <AuthorListFull authors={authors} />
        }
      </div>
    </div>
  )
}
