import type { Inline } from '@/content/inline'
import type { Table } from '@/content/table-schema'
import { z } from 'zod'
import { boundedString, color, safeURL, UUID } from '@/content/base'
import { inline } from '@/content/inline'
import { table, textProps } from '@/content/table-schema'

export const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'toggleListItem',
  'quote',
  'codeBlock',
  'divider',
  'table',
  'image',
  'audio',
  'video',
  'file',
  'callout',
  'footnote',
  'math',
  'mermaid',
  'toc',
  'linkCard',
  'embed',
] as const
export type BlockType = (typeof BLOCK_TYPES)[number]
export type Block = {
  id: string
  type: BlockType
  props: Record<string, string | number | boolean>
  content?: Inline[] | Table
  children: Block[]
}

export const block: z.ZodType<Block> = z.lazy(() =>
  z.strictObject({
    id: UUID,
    type: z.enum(BLOCK_TYPES),
    props: z.record(z.string(), z.union([
      z.string(),
      z.number(),
      z.boolean(),
    ])),
    content: z.union([
      z.array(inline),
      table,
    ]).optional(),
    children: z.array(block),
  }),
)
const media = {
  backgroundColor: color,
  name: boundedString(240),
  url: z
    .string()
    .regex(
      /^(?:\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?$/,
    ),
  caption: boundedString(500),
}
const visualMedia = {
  ...media,
  showPreview: z.boolean(),
  textAlignment: textProps.textAlignment,
  previewWidth: z.number().min(40).max(2000).optional(),
}
export const props: Record<BlockType, z.ZodType> = {
  paragraph: z.strictObject(textProps),
  heading: z.strictObject({
    ...textProps,
    level: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
    ]),
  }),
  bulletListItem: z.strictObject(textProps),
  toggleListItem: z.strictObject(textProps),
  numberedListItem: z.strictObject({
    ...textProps,
    start: z.number().int().min(1).max(100000).optional(),
  }),
  checkListItem: z.strictObject({
    ...textProps,
    checked: z.boolean(),
  }),
  quote: z.strictObject({
    textColor: color,
    backgroundColor: color,
  }),
  codeBlock: z.strictObject({
    language: z.string().regex(/^[a-z0-9+#.-]{1,30}$/),
  }),
  divider: z.strictObject({}),
  table: z.strictObject({
    textColor: color,
  }),
  image: z.strictObject(visualMedia),
  video: z.strictObject(visualMedia),
  audio: z.strictObject({
    ...media,
    showPreview: z.boolean(),
  }),
  file: z.strictObject(media),
  callout: z.strictObject({
    tone: z.enum([
      'info',
      'warning',
      'success',
      'danger',
    ]),
  }),
  footnote: z.strictObject({}),
  math: z.strictObject({}),
  mermaid: z.strictObject({
    description: boundedString(500),
  }),
  toc: z.strictObject({
    title: boundedString(200),
  }),
  linkCard: z.strictObject({
    url: z.union([
      z.literal(''),
      boundedString(2048).refine(safeURL),
    ]),
    title: boundedString(200),
    description: boundedString(500),
  }),
  embed: z.strictObject({
    provider: z.literal('youtube'),
    videoId: z.string().regex(/^(?:[\w-]{11})?$/),
    title: boundedString(200),
  }),
}
