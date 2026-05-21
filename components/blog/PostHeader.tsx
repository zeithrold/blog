import type { PageMeta } from '@/lib/types/posts'
import Image from 'next/image'
import { Tag } from './Tag'

interface ArticleCoverProps {
  src: string
  alt: string
}

/**
 * Full-bleed cover below the site header; not constrained by article container padding.
 */
export function ArticleCover({ src, alt }: ArticleCoverProps) {
  return (
    <div className="relative h-40 w-full max-h-96 shrink-0 overflow-hidden sm:h-44 md:h-52">
      <Image
        src={src}
        alt={alt}
        fill
        priority
        className="object-cover object-center"
        unoptimized
      />
    </div>
  )
}

/**
 * Article metadata (title, author, tags) aligned with Notion content width.
 */
export function PostHeader({ title, created_time, author, tags }: PageMeta) {
  const parsedDate = new Date(created_time).toLocaleString()

  return (
    <header className="notion-page-inset-x flex flex-col gap-2">
      <h1 className="font-serif text-3xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        {author.name}
        {' '}
        ·
        {' '}
        {parsedDate}
      </p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <Tag key={tag.id} {...tag} />
          ))}
        </div>
      )}
    </header>
  )
}
