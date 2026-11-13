import type { BlockConverter } from './block-shape'
import { z } from 'zod'
import { NotionContentError, richTextSchema } from './api'

const structuralConverters: Readonly<Record<string, BlockConverter>> = {
  divider: context => ({ ...context.base, type: 'divider' }),
  table_of_contents: context => ({ ...context.base, type: 'table_of_contents' }),
  column_list: context => ({ ...context.base, type: 'column_list' }),
  column: context => ({ ...context.base, type: 'column', format: { column_ratio: 1 } }),
  synced_block: (context) => {
    z.object({ synced_from: z.null() }).parse(context.data)
    return { ...context.base, type: 'transclusion_container' }
  },
  table: (context) => {
    const table = z.object({
      table_width: z.number().int().positive(),
      has_column_header: z.boolean(),
      has_row_header: z.boolean(),
    }).parse(context.data)
    for (const child of context.blocks.filter(row => row.parentId === context.base.id)) {
      if (child.block.type !== 'table_row') {
        throw new NotionContentError('Invalid table row')
      }
      z.object({
        cells: z.array(z.array(richTextSchema)).length(table.table_width),
      }).parse(child.block.table_row)
    }
    return {
      ...context.base,
      type: 'table',
      collection_id: '',
      view_ids: [],
      format: {
        collection_pointer: { id: '', table: 'collection', spaceId: '' },
        table_block_column_order: Array.from({ length: table.table_width }, (_, index) => String(index)),
        table_block_column_header: table.has_column_header,
        table_block_row_header: table.has_row_header,
      },
    }
  },
  table_row: (context) => {
    const row = z.object({ cells: z.array(z.array(richTextSchema)) }).parse(context.data)
    return {
      ...context.base,
      type: 'table_row',
      properties: Object.fromEntries(row.cells.map((cell, index) => [
        String(index),
        context.rich(cell),
      ])),
    }
  },
}

export { structuralConverters }
