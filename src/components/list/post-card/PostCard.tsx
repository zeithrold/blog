import type { AuthorListType, TagListType } from '@/components/meta'
import CoverImage from './CoverImage'
import PostCardContent from './PostCardContent'

export interface PostCardProps {
  title: string
  content: string
  authors: AuthorListType
  slug: string
  date: Date
  image?: string
  tags?: TagListType
  featured?: boolean
}

export default function PostCard({
  title,
  content,
  authors,
  slug,
  date,
  image,
  tags,
  featured,
}: PostCardProps) {
  return (
    <div
      className={`
        box-border rounded-xl border border-inner col-1 transition-all
        duration-300

        hover:scale-[1.02] hover:bg-gray-100 hover:shadow-2xl
      `}
    >
      <CoverImage
        slug={slug}
        src={image}
        featured={featured}
      />
      <PostCardContent
        title={title}
        content={content}
        authors={authors}
        slug={slug}
        date={date}
        tags={tags}
      />
    </div>
  )
}
