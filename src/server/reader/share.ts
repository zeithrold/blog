import type { PublicItem } from '@/contracts/notion'

type ShareImage = {
  readonly url: string
  readonly alt: string
  readonly width?: number
  readonly height?: number
  readonly type?: 'image/png'
}

export function shareImage(origin: string, item?: PublicItem): ShareImage {
  return item !== undefined && item.cover !== null
    ? { url: `${origin}/notion-media/${item.id}/cover`, alt: item.title }
    : {
        url: `${origin}/share.png`,
        alt: 'zeithrold/blog - Notes on building things.',
        width: 1200,
        height: 630,
        type: 'image/png',
      }
}
