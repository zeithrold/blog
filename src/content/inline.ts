import { z } from 'zod'
import { boundedString, color, safeURL, UUID } from '@/content/base'

export const styles = z.strictObject({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  code: z.boolean().optional(),
  textColor: color.optional(),
  backgroundColor: color.optional(),
})
const text = z.strictObject({
  type: z.literal('text'),
  text: z.string(),
  styles,
})
export const inline = z.discriminatedUnion('type', [
  text,
  z.strictObject({
    type: z.literal('link'),
    href: boundedString(2048).refine(safeURL),
    content: z.array(text),
  }),
  z.strictObject({
    type: z.literal('citation'),
    props: z.strictObject({
      referenceId: z.union([
        UUID,
        z.literal(''),
      ]),
      locator: boundedString(100),
    }),
    content: z.undefined().optional(),
  }),
  z.strictObject({
    type: z.literal('footnoteRef'),
    props: z.strictObject({
      noteId: z.union([
        UUID,
        z.literal(''),
      ]),
    }),
    content: z.undefined().optional(),
  }),
  z.strictObject({
    type: z.literal('inlineMath'),
    props: z.strictObject({
      source: boundedString(4096),
    }),
    content: z.undefined().optional(),
  }),
])
export type Inline = z.infer<typeof inline>
export type Styles = z.infer<typeof styles>
