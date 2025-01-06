import Image from 'next/image'
import Link from 'next/link'

export interface CoverImageProps {
  slug: string
  src?: string
}

export default function CoverImage({ slug, src }: CoverImageProps) {
  return (
    <Link
      href={`/-/${slug}`}
    >
      <Image
        src={src ?? '/sample.jpg'}
        width={600}
        height={400}
        className="max-h-96 w-full rounded-t-xl object-cover"
        alt="Cover Image for the article"
      />
    </Link>
  )
}
