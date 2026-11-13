import type { Block, Decoration } from 'notion-types'
import type { PublicPath } from '@/contracts/notion'
import { z } from 'zod'
import { dateTime } from './api'

export const blockSchema = z.object({
  object: z.literal('block'),
  id: z.string().min(1),
  type: z.string(),
  has_children: z.boolean(),
  in_trash: z.boolean(),
  created_time: dateTime,
  last_edited_time: dateTime,
}).loose()

export const storedBlockSchema = z.object({
  block: blockSchema,
  parentId: z.string(),
  children: z.array(z.string()),
})

export type StoredBlock = z.infer<typeof storedBlockSchema>

export function blockBase(entry: StoredBlock): {
  id: string
  parent_id: string
  parent_table: 'block'
  version: number
  created_time: number
  last_edited_time: number
  alive: boolean
  created_by_table: string
  created_by_id: string
  last_edited_by_table: string
  last_edited_by_id: string
  content: string[]
} {
  return {
    id: entry.block.id,
    parent_id: entry.parentId,
    parent_table: 'block',
    version: 1,
    created_time: Date.parse(entry.block.created_time),
    last_edited_time: Date.parse(entry.block.last_edited_time),
    alive: true,
    created_by_table: 'notion_user',
    created_by_id: '',
    last_edited_by_table: 'notion_user',
    last_edited_by_id: '',
    content: entry.children,
  }
}

export type ConversionContext = {
  readonly base: ReturnType<typeof blockBase>
  readonly data: unknown
  readonly blocks: readonly StoredBlock[]
  readonly links: Readonly<Record<string, PublicPath>>
  readonly rich: (value: unknown) => Decoration[]
  readonly expiries: number[]
}
export type BlockConverter = (context: ConversionContext) => Block
