import type { ReactNode } from 'react'
import { SiteAfterword } from '@/features/reader/post-list'

const contentClass = [
  'site-content w-[min(var(--blog-content-width),_calc(100%_-_96px))] mx-auto',
  'max-[960px]:w-[calc(100%_-_64px)] max-[701px]:w-[calc(100%_-_40px)]',
  'max-[360px]:w-[calc(100%_-_32px)]',
].join(' ')

export default function TagsLayout({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <div className={contentClass} id="top">
      {children}
      <SiteAfterword />
    </div>
  )
}
