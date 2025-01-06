import type { AuthorListType } from './AuthorList'
import Link from 'next/link'
import AuthorList from './AuthorList'

export interface ContentProps {
  title: string
  content: string
  authors: AuthorListType
  slug: string
}

export default function Content({ title, content, authors, slug }: ContentProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <Link
          href={`/-/${slug}`}
          className={`
            text-xl font-bold

            focus:text-stone-500

            hover:underline

            md:text-2xl
          `}
        >
          <h3>
            {title}
          </h3>
        </Link>
        <p className="max-h-24 overflow-hidden text-gray-600">{content}</p>
      </div>
      <AuthorList authors={authors} />
    </div>
  )
}
