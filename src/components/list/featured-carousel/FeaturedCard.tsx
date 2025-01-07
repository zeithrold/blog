import { AuthorList, type AuthorListType, DateInfo } from '@/components/meta'
import Image from 'next/image'
import Link from 'next/link'
import { BiSolidStar } from 'react-icons/bi'

export interface FeaturedCardProps {
  title: string
  image: string
  slug: string
  content: string
  authors: AuthorListType
  date: Date
}

export default function FeaturedCard({
  title,
  image,
  authors,
  date,
  slug,
  content,
}: FeaturedCardProps) {
  return (
    <div className={`
      flex w-full min-w-full flex-col gap-4 p-2

      lg:flex-row

      md:gap-8
    `}
    >
      <Link
        href={`/-/${slug}`}
        className={`
          relative h-32 flex-1

          lg:h-96

          md:h-64
        `}
      >

        <span
          className={`
            absolute left-2 top-2 flex items-center gap-1 rounded-xl bg-primary
            px-2 py-0.5 text-sm text-primary-content
          `}
        >
          <BiSolidStar />
          Featured
        </span>
        <Image
          alt="Featured Image"
          width={600}
          height={300}
          src={image}
          className="h-full w-full rounded-xl object-cover"
        />
      </Link>
      <div className={`
        flex w-full flex-col justify-center gap-2

        lg:w-96
      `}
      >
        <Link
          href={`/-/${slug}`}
          className="hover:underline"
        >
          <h1 className="text-3xl font-bold">{title}</h1>
        </Link>
        <p className="max-h-36 overflow-hidden font-serif text-gray-600">{content}</p>
        <AuthorList authors={authors} />
        <DateInfo date={date} />
      </div>
    </div>
  )
}
