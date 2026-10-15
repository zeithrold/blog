import { z } from 'zod'
import { color } from '@/content/base'
import { inline } from '@/content/inline'
import { TABLE_COLUMN_MAX_WIDTH, TABLE_COLUMN_MIN_WIDTH } from '@/content/table-limits'

export const textProps = {
  textAlignment: z.enum([
    'left',
    'center',
    'right',
    'justify',
  ]),
  textColor: color,
  backgroundColor: color,
}
const cellProps = z.strictObject({
  ...textProps,
  colspan: z.number().int().min(1).max(20).optional(),
  rowspan: z.number().int().min(1).max(100).optional(),
})
const tableCell = z.union([
  z.array(inline),
  z.strictObject({
    type: z.literal('tableCell'),
    props: cellProps,
    content: z.array(inline),
  }),
])
export const table = z.strictObject({
  type: z.literal('tableContent'),
  columnWidths: z
    .array(z.union([
      z.number().min(TABLE_COLUMN_MIN_WIDTH).max(TABLE_COLUMN_MAX_WIDTH),
      z.null(),
      z.undefined(),
    ]))
    .min(1)
    .max(20),
  headerRows: z.number().int().min(0).max(100).optional(),
  headerCols: z.number().int().min(0).max(20).optional(),
  rows: z
    .array(
      z.strictObject({
        cells: z.array(tableCell).max(20),
      }),
    )
    .min(1)
    .max(100),
})
export type Table = z.infer<typeof table>
export type Cell = z.infer<typeof tableCell>
