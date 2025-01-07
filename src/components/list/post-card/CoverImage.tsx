import Image from 'next/image'
import Link from 'next/link'
import { BiSolidStar } from 'react-icons/bi'

export interface CoverImageProps {
  slug: string
  src?: string
  featured?: boolean
}

export default function CoverImage({ slug, src, featured }: CoverImageProps) {
  return (
    <Link
      href={`/-/${slug}`}
      className="relative"
    >
      {
        featured
        && (
          <span
            className={`
              absolute left-2 top-2 flex items-center gap-1 rounded-xl
              bg-primary px-2 py-0.5 text-sm text-primary-content
            `}
          >
            <BiSolidStar />
            Featured
          </span>
        )
      }
      <Image
        src={src ?? '/sample.jpg'}
        width={400}
        height={400}
        className={`
          h-48 w-full rounded-t-xl object-cover

          sm:h-64
        `}
        alt="Cover Image for the article"
      />
    </Link>
  )
}
