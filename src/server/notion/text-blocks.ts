import type { Block, Decoration } from 'notion-types'
import type { BlockConverter, ConversionContext } from './block-shape'
import { z } from 'zod'
import { canonicalId, richTextSchema } from './api'
import { blockColor } from './rich-text'

const contentSchema = z.object({ rich_text: z.array(richTextSchema), color: z.string().optional() })

type TextKind = 'text' | 'header' | 'sub_header' | 'sub_sub_header' | 'header_4'
  | 'bulleted_list' | 'numbered_list' | 'quote' | 'toggle'

function convertText<T extends TextKind>(context: ConversionContext, type: T) {
  const content = contentSchema.parse(context.data)
  const color = blockColor(content.color)
  return {
    ...context.base,
    type,
    properties: { title: context.rich(content.rich_text) },
    ...(color === undefined ? {} : { format: { block_color: color } }),
  }
}

function pageLink(context: ConversionContext, id: string): Block {
  const path = context.links[canonicalId(id)]
  const title: Decoration = path === undefined
    ? ['Page']
    : [
        path,
        [
          ['a', path],
        ],
      ]
  return { ...context.base, type: 'text', properties: { title: [title] } }
}

const textConverters: Readonly<Record<string, BlockConverter>> = {
  paragraph: context => convertText(context, 'text'),
  heading_1: context => convertText(context, 'header'),
  heading_2: context => convertText(context, 'sub_header'),
  heading_3: context => convertText(context, 'sub_sub_header'),
  heading_4: context => convertText(context, 'header_4'),
  bulleted_list_item: context => convertText(context, 'bulleted_list'),
  numbered_list_item: context => convertText(context, 'numbered_list'),
  quote: context => convertText(context, 'quote'),
  toggle: context => convertText(context, 'toggle'),
  to_do: (context) => {
    const todo = contentSchema.extend({ checked: z.boolean() }).parse(context.data)
    const color = blockColor(todo.color)
    return {
      ...context.base,
      type: 'to_do',
      ...(color === undefined ? {} : { format: { block_color: color } }),
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
      format: { page_icon: callout.icon?.emoji ?? '', block_color: blockColor(callout.color) ?? 'gray' },
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
    return pageLink(context, link.page_id)
  },
  child_page: (context) => {
    z.object({ title: z.string() }).parse(context.data)
    return pageLink(context, context.base.id)
  },
}

export { textConverters }
