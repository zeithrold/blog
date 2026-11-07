import type { ReactNode } from 'react'
import type { Document } from '@/content/document'
import { Hash } from 'lucide-react'

type Props = {
  readonly tag: Pick<Document['meta']['tags'][number], 'label' | 'color'>
  readonly href?: string
}

const chipClass = [
  'tag-color relative inline-flex min-h-[34px] max-w-full items-center gap-1.5',
  'rounded-full border border-border bg-card px-2.5 py-1 font-sans text-help text-muted-foreground wrap-anywhere',
].join(' ')

const linkClass = [
  'taxonomy-chip no-underline transition-colors duration-200',
  'hover:border-[color-mix(in_srgb,_var(--ztd-accent)_50%,_var(--ztd-border))] hover:text-foreground',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
].join(' ')

export function TagChip({ tag, href }: Props): ReactNode {
  const Element = href === undefined ? 'span' : 'a'
  return (
    <Element
      className={href === undefined ? chipClass : `${chipClass} ${linkClass}`}
      data-tag-color={tag.color ?? 'neutral'}
      href={href}
    >
      <Hash size={13} className="shrink-0" aria-hidden="true" />
      <span className="min-w-0">{tag.label}</span>
    </Element>
  )
}
