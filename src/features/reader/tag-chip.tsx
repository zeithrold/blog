import type { ReactNode } from 'react'
import type { PublicTag } from '@/contracts/notion'
import { Hash } from 'lucide-react'

const chipClass = [
  'reader-tag relative inline-flex min-h-[34px] max-w-full items-center gap-1.5',
  'rounded-full border px-2.5 py-1 font-sans text-help wrap-anywhere',
].join(' ')

export function TagChip({ tag }: { readonly tag: PublicTag }): ReactNode {
  return (
    <span className={chipClass} data-tag-color={tag.color}>
      <Hash size={13} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0">{tag.label}</span>
    </span>
  )
}
