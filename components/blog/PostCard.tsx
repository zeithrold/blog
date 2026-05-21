import type { PageItem } from '@/lib/types/posts'
import { ArrowRightIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tag } from './Tag'

/**
 * Post summary card for list views.
 */
export function PostCard({ id, title, created_time, author, summary, cover, tags }: PageItem) {
  const parsedDate = new Date(created_time).toLocaleString()
  const postHref = `/-/${id}`

  return (
    <Card className="transition duration-300 hover:scale-[1.01] hover:shadow-lg">
      <CardHeader>
        <Link href={postHref}>
          <CardTitle className="text-xl hover:underline">{title}</CardTitle>
        </Link>
        <CardDescription>
          Created by
          {' '}
          {author.name}
          {' '}
          at
          {' '}
          {parsedDate}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 flex-1">
        {cover != null && cover !== '' && (
          <div className="relative h-48 w-full overflow-hidden rounded-lg">
            <Image src={cover} alt={title} fill className="object-cover" unoptimized />
          </div>
        )}
        <p className="line-clamp-3 break-words text-sm text-muted-foreground">{summary}</p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <Tag key={tag.id} {...tag} />
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <ButtonLink href={postHref} variant="outline" size="sm">
          Continue
          <ArrowRightIcon />
        </ButtonLink>
      </CardFooter>
    </Card>
  )
}
