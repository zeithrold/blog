import type { AuthorListType, TagListType } from '@/components/meta'
import { AuthorList, DateInfo, TagList } from '@/components/meta'
import Link from 'next/link'

export interface PostCardContentProps {
  title: string
  content: string
  authors: AuthorListType
  slug: string
  date: Date
  tags?: TagListType
}

export default function PostCardContent({
  title,
  content,
  authors,
  slug,
  tags,
  date,
}: PostCardContentProps) {
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
        <p className="max-h-24 overflow-hidden font-serif text-gray-600">{content}</p>
      </div>
      <div className="flex flex-col gap-2">
        <AuthorList authors={authors} />
        <DateInfo date={date} />
        <TagList tags={tags} />
      </div>
      {/* <TagList tags={tags} /> */}
    </div>
  )
}
