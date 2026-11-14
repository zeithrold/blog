import type { Metadata } from 'next'
import type { PublicItem } from '@/contracts/notion'
import { env } from 'cloudflare:workers'
import { notFound } from 'next/navigation'
import { publicOrigin } from '@/server/runtime/origin'

type ListingPage = {
  readonly items: readonly PublicItem[]
  readonly offset: number
  readonly nextOffset: number | null
}

export function paginate(items: readonly PublicItem[], rawOffset: string | string[] | undefined): ListingPage {
  const value = rawOffset ?? '0'
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value)) {
    notFound()
  }
  const offset = Number(value)
  if (!Number.isSafeInteger(offset) || offset > 100000 || (offset > 0 && offset >= items.length)) {
    notFound()
  }
  return {
    items: items.slice(offset, offset + 50),
    offset,
    nextOffset: offset + 50 < items.length ? offset + 50 : null,
  }
}

export function listingMetadata(path: string, title: string, description: string, offset = 0): Metadata {
  const canonical = publicOrigin(env) + path + (offset === 0 ? '' : `?offset=${offset}`)
  const heading = offset === 0 ? title : `${title} · From post ${offset + 1}`
  return {
    title: { absolute: `${heading} · zeithrold/blog` },
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { type: 'website', title: heading, description, url: canonical },
  }
}
