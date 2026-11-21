import type { Block, Decoration } from 'notion-types'
import type { BlockConverter, ConversionContext } from './block-shape'
import { z } from 'zod'
import { embedFrameUrl } from '@/contracts/embed'
import { media, mediaSchema, richTextSchema } from './api'
import { publicLink } from './rich-text'

const mediaContentSchema = z.intersection(mediaSchema, z.object({
  caption: z.array(richTextSchema),
  name: z.string().optional(),
}))

const urlContentSchema = z.object({ url: z.url({ protocol: /^https?$/ }) })
const embedSchema = urlContentSchema.extend({ caption: z.array(richTextSchema).default([]) })

function linkCard(context: ConversionContext, url: string, title: Decoration[]): Block {
  const href = publicLink(url, context.links)
  if (href === null) {
    return { ...context.base, type: 'text', properties: { title: title.length === 0
      ? [
          ['Link unavailable'],
        ]
      : title } }
  }
  return {
    ...context.base,
    type: 'bookmark',
    properties: { link: [
      [href],
    ], title, description: [] },
    format: { bookmark_icon: '', bookmark_cover: '' },
  }
}

function convertMedia(context: ConversionContext, type: 'image' | 'audio' | 'video' | 'file'): Block {
  const content = mediaContentSchema.parse(context.data)
  const asset = media(content)
  if (asset.expiresAt !== null) {
    context.expiries.push(asset.expiresAt)
  }
  if (type === 'file') {
    return {
      ...context.base,
      type,
      properties: {
        source: [
          [asset.url],
        ],
        title: [
          [
            content.name ?? 'File',
          ],
        ],
        size: [],
      },
    }
  }
  return {
    ...context.base,
    type,
    properties: { source: [
      [asset.url],
    ], caption: context.rich(content.caption) },
  }
}

const mediaConverters: Readonly<Record<string, BlockConverter>> = {
  image: context => convertMedia(context, 'image'),
  audio: context => convertMedia(context, 'audio'),
  video: context => convertMedia(context, 'video'),
  file: context => convertMedia(context, 'file'),
  pdf: context => convertMedia(context, 'file'),
  embed: (context) => {
    const { url, caption } = embedSchema.parse(context.data)
    const frame = embedFrameUrl(url)
    const title = context.rich(caption)
    return frame === null
      ? linkCard(context, url, title)
      : { ...context.base, type: 'embed', properties: { source: [
          [frame],
        ], caption: title } }
  },
  link_preview: (context) => {
    const { url } = urlContentSchema.parse(context.data)
    return linkCard(context, url, [])
  },
  bookmark: (context) => {
    const bookmark = embedSchema.parse(context.data)
    return linkCard(context, bookmark.url, context.rich(bookmark.caption))
  },
}

export { mediaConverters }
