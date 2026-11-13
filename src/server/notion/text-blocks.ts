import type { Decoration } from 'notion-types'
import type { BlockConverter, ConversionContext } from './block-shape'
import { z } from 'zod'
import { canonicalId, richTextSchema } from './api'

const contentSchema = z.object({ rich_text: z.array(richTextSchema) })

function title(context: ConversionContext): Decoration[] {
  return context.rich(contentSchema.parse(context.data).rich_text)
}

const textConverters: Readonly<Record<string, BlockConverter>> = {
  paragraph: context => ({ ...context.base, type: 'text', properties: { title: title(context) } }),
  heading_1: context => ({ ...context.base, type: 'header', properties: { title: title(context) } }),
  heading_2: context => ({ ...context.base, type: 'sub_header', properties: { title: title(context) } }),
  heading_3: context => ({ ...context.base, type: 'sub_sub_header', properties: { title: title(context) } }),
  heading_4: context => ({ ...context.base, type: 'header_4', properties: { title: title(context) } }),
  bulleted_list_item: context => ({ ...context.base, type: 'bulleted_list', properties: { title: title(context) } }),
  numbered_list_item: context => ({ ...context.base, type: 'numbered_list', properties: { title: title(context) } }),
  quote: context => ({ ...context.base, type: 'quote', properties: { title: title(context) } }),
  toggle: context => ({ ...context.base, type: 'toggle', properties: { title: title(context) } }),
  to_do: (context) => {
    const todo = contentSchema.extend({ checked: z.boolean() }).parse(context.data)
    return {
      ...context.base,
      type: 'to_do',
      properties: {
        title: context.rich(todo.rich_text),
        checked: [
          [
            todo.checked ? 'Yes' : 'No',
          ],
        ],
      },
    }
  },
  callout: (context) => {
    const callout = contentSchema.extend({
      icon: z.object({ type: z.string(), emoji: z.string().optional() }).nullable(),
    }).parse(context.data)
    return {
      ...context.base,
      type: 'callout',
      properties: { title: context.rich(callout.rich_text) },
      format: { page_icon: callout.icon?.emoji ?? '', block_color: 'gray' },
    }
  },
  equation: (context) => {
    const equation = z.object({ expression: z.string() }).parse(context.data)
    return { ...context.base, type: 'equation', properties: { title: [
      [equation.expression],
    ] } }
  },
  code: (context) => {
    const code = contentSchema.extend({ language: z.string(), caption: z.array(richTextSchema) }).parse(context.data)
    return {
      ...context.base,
      type: 'code',
      properties: {
        title: context.rich(code.rich_text),
        language: [
          [code.language],
        ],
        caption: context.rich(code.caption),
      },
    }
  },
  link_to_page: (context) => {
    const link = z.object({ type: z.literal('page_id'), page_id: z.string() }).parse(context.data)
    const path = context.links[canonicalId(link.page_id)]
    return {
      ...context.base,
      type: 'text',
      properties: { title: path === undefined
        ? [
            ['Page'],
          ]
        : [
            [
              path,
              [
                ['a', path],
              ],
            ],
          ] },
    }
  },
}

export { textConverters }
