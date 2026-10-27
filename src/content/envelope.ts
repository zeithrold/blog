import { z } from 'zod'
import { boundedString, safeURL, SLUG, UUID } from '@/content/base'
import { block } from '@/content/blocks'
import { tagColorSchema } from '@/content/tag-color'

export const envelope = z.strictObject({
  format: z.literal('blocknote'),
  schemaVersion: z.literal(1),
  blockSchema: z.literal('blog-blocknote-v1'),
  meta: z.strictObject({
    title: boundedString(200),
    slug: z.union([
      SLUG,
      z.literal(''),
    ]),
    documentLocale: z.enum(['en', 'zh-CN']),
    description: boundedString(500),
    seo: z.strictObject({
      noindex: z.boolean(),
    }),
    tags: z
      .array(
        z.strictObject({
          id: UUID,
          slug: SLUG,
          label: boundedString(200).min(1),
          color: tagColorSchema.optional(),
        }),
      )
      .max(50),
    series: z
      .array(
        z.strictObject({
          id: UUID,
          slug: SLUG,
          title: boundedString(200).min(1),
          position: z.number().int().min(0).max(100000),
        }),
      )
      .max(10),
  }),
  blocks: z.array(block).min(1),
  references: z
    .array(
      z.strictObject({
        id: UUID,
        title: boundedString(500).min(1),
        authors: z.array(boundedString(200).min(1)).min(1).max(50),
        year: z.number().int().min(1).max(9999).nullable(),
        url: z.union([
          z.literal(''),
          boundedString(2048).refine(safeURL),
        ]),
        doi: z.union([
          z.literal(''),
          z.string().regex(/^10\.\d{4,9}\/\S+$/),
        ]),
      }),
    )
    .max(500),
  citationStyle: z.literal('ztd-numeric-v1'),
  mediaAccessibility: z.record(
    UUID,
    z.strictObject({
      alt: boundedString(2000),
      decorative: z.boolean(),
      transcript: boundedString(32768),
      captionAssetId: UUID.nullable(),
      posterAssetId: UUID.nullable(),
    }),
  ),
  tableAccessibility: z.record(
    UUID,
    z.strictObject({
      caption: boundedString(500),
    }),
  ),
})
export type Document = z.infer<typeof envelope>
