import type { ReactNode } from 'react'
import type { PublicTag } from '@/contracts/notion'
import { Hash } from 'lucide-react'
import Link from 'next/link'
import { tagUrl } from '@/contracts/notion'

const chipClass = [
  'reader-tag relative inline-flex min-h-9 min-w-11 max-w-full items-center justify-center gap-1.5',
  'rounded-full border px-2.5 py-1 font-sans text-help wrap-anywhere no-underline',
  'hover:underline focus-visible:outline-2 focus-visible:outline-offset-2',
  'after:absolute after:-top-px after:inset-x-0 after:h-11 after:content-[""]',
].join(' ')

export function TagChip({ tag }: { readonly tag: PublicTag }): ReactNode {
  return (
    <Link href={tagUrl(tag.id)} className={chipClass} data-tag-color={tag.color}>
      <Hash size={13} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0">{tag.label}</span>
    </Link>
  )
}
