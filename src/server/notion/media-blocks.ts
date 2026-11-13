import type { Block } from 'notion-types'
import type { BlockConverter, ConversionContext } from './block-shape'
import { z } from 'zod'
import { media, mediaSchema, richTextSchema } from './api'

const mediaContentSchema = z.intersection(mediaSchema, z.object({
  caption: z.array(richTextSchema),
  name: z.string().optional(),
}))

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
  bookmark: (context) => {
    const bookmark = z.object({
      url: z.url({ protocol: /^https?$/ }),
      caption: z.array(richTextSchema),
    }).parse(context.data)
    return {
      ...context.base,
      type: 'bookmark',
      properties: {
        link: [
          [bookmark.url],
        ],
        title: context.rich(bookmark.caption),
        description: [],
      },
      format: { bookmark_icon: '', bookmark_cover: '' },
    }
  },
}

export { mediaConverters }
