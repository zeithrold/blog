import type { TagListType, Tag as TagType } from '../meta/types'
import { BiPurchaseTag } from 'react-icons/bi'
import Tag from './Tag'

export interface TagListProps {
  tags?: TagListType
  mode?: 'full' | 'compact'
}

function TagListCompact({ tags, mode }: { tags: TagListType, mode: 'full' | 'compact' }) {
  let slicedTags: TagType[] = tags
  const tagLength = tags.length
  if (tags.length > 2) {
    slicedTags = tags.slice(0, 2)
  }
  return (
    <div className="flex flex-1 flex-wrap gap-x-2 gap-y-1">
      {
        slicedTags.map(tag => (
          <Tag tag={tag} key={tag.slug} mode={mode} />
        ))
      }
      {
        tagLength > 2 && (
          <span>
            and
            {' '}
            {tagLength - 2}
            {' '}
            more
          </span>
        )
      }
    </div>
  )
}

function TagListFull({ tags, mode }: { tags: TagListType, mode: 'full' | 'compact' }) {
  return (
    <div className="flex flex-1 flex-wrap gap-x-2 gap-y-1">
      {
        tags.map(tag => (
          <Tag tag={tag} key={tag.slug} mode={mode} />
        ))
      }
    </div>
  )
}

export default function TagList({ tags, mode = 'compact' }: TagListProps) {
  return (

    <div className={`
      flex flex-1 items-center gap-2

      ${mode === 'compact' ? 'text-sm' : ''}

      text-gray-600
    `}
    >
      <BiPurchaseTag className={`
        ${mode === 'full' ? 'text-lg' : ''}
      `}
      />
      {
        (!tags || tags.length === 0)
          ? <span>No Tags</span>
          : mode === 'compact'
            ? <TagListCompact tags={tags} mode={mode} />
            : <TagListFull tags={tags} mode={mode} />
      }
    </div>
  )
}
