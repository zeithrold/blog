import type { Tag as TagType } from '../meta/types'
import { colord } from 'colord'
import Link from 'next/link'

export interface TagProps {
  tag: TagType
  mode: 'full' | 'compact'
}

function getTextClass(backgroundColor?: string) {
  if (!backgroundColor) {
    return 'text-black'
  }
  const isLight = colord(backgroundColor).isLight()
  return isLight ? 'text-black' : 'text-white'
}

export default function Tag({ tag, mode }: TagProps) {
  return (
    <Link
      className={`
        rounded-xl p-0.5 px-2

        ${mode === 'full' ? 'text-sm' : 'text-xs'}
        ${getTextClass(tag.color)}
      `}
      style={{
        backgroundColor: tag.color ?? '#f0f0f0',
      }}
      href={`/tag/${tag.slug}`}
    >
      #
      {tag.name}
    </Link>
  )
}
