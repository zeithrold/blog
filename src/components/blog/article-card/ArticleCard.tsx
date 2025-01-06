import type { AuthorListType } from './AuthorList'
import Content from './Content'
import CoverImage from './CoverImage'

export interface ArticleCardProps {
  title: string
  content: string
  authors: AuthorListType
  slug: string
  image?: string
}

export default function ArticleCard({
  title,
  content,
  authors,
  slug,
  image,
}: ArticleCardProps) {
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
      />
      <Content
        title={title}
        content={content}
        authors={authors}
        slug={slug}
      />
    </div>
  )
}
