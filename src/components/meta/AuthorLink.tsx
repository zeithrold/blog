import type { Author } from './types'
import Link from 'next/link'
import Avatar from './Avatar'

export default function AuthorLink({
  name,
  avatar,
  username,
}: Author) {
  return (
    <div className="flex items-center gap-2">
      <Avatar src={avatar} />
      <Link
        href={`/author/@${username}`}
        className={`
          focus:text-stone-400

          hover:underline
        `}
      >
        {name}
      </Link>
    </div>
  )
}
