'use client'

import type { ReactNode } from 'react'
import type { PageSnapshot } from '@/contracts/notion'
import { MediaExpiryRefresh } from './media-expiry-refresh'
import { NotionBody } from './notion-body'
import { ReaderHeader } from './reader-header'
import { ReaderNavigation } from './reader-navigation'

const coverClass = [
  'reader-cover w-[min(var(--blog-content-width),_calc(100%_-_48px))] mx-auto pt-14',
  'max-[701px]:w-[calc(100%_-_24px)] max-[701px]:pt-10',
].join(' ')

export function DocumentReader({ page }: { readonly page: PageSnapshot }): ReactNode {
  const { item } = page
  const expiries = [page.mediaExpiresAt, item.cover?.expiresAt]
    .filter((value): value is number => value !== null && value !== undefined)
  return (
    <ReaderNavigation
      cover={item.cover !== null && (
        <div className={coverClass}>
          <img
            className="block w-full h-auto aspect-[5/2] object-cover rounded-[12px] bg-muted max-[701px]:aspect-video"
            src={item.cover.url}
            alt=""
            width={1500}
            height={600}
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </div>
      )}
    >
      <MediaExpiryRefresh expiresAt={expiries.length === 0 ? null : Math.min(...expiries)} />
      <ReaderHeader item={item} />
      <NotionBody page={page} />
    </ReaderNavigation>
  )
}
