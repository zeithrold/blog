import type { ReactNode } from 'react'
import type { Table } from '@/content/document'
import type { CellPlacement } from '@/content/table-validation'
import type { ReaderContext } from '@/features/reader/context'
import { tableLayout } from '@/content/table-validation'
import { Inlines } from '@/features/reader/inlines'

function TableCell({
  placement,
  table,
  context,
  blockId,
}: {
  placement: CellPlacement
  table: Table
  context: ReaderContext
  blockId: string
}): ReactNode {
  const { cell, row, column, cols, rows, offset } = placement
  const headerRow = row < (table.headerRows ?? 0)
  const headerColumn = column < (table.headerCols ?? 0)
  const data = Array.isArray(cell) ? undefined : cell.props
  const props = {
    'colSpan': cols,
    'rowSpan': rows,
    'data-text-color': data?.textColor,
    'data-background-color': data?.backgroundColor,
    'data-alignment': data?.textAlignment,
  }
  const content = (
    <Inlines
      items={Array.isArray(cell) ? cell : cell.content}
      context={context}
      blockId={blockId}
      offset={offset}
    />
  )
  if (headerRow) {
    return (
      <th {...props} scope="col">
        {content}
      </th>
    )
  }
  if (headerColumn) {
    return (
      <th {...props} scope="row">
        {content}
      </th>
    )
  }
  return <td {...props}>{content}</td>
}
export function TableView({
  table,
  context,
  blockId,
}: {
  table: Table
  context: ReaderContext
  blockId: string
}): ReactNode {
  const placements = tableLayout(table)
  const columns = table.columnWidths.map((width, position) => ({
    width,
    key: `${blockId}-column-${position}`,
  }))
  const rows = placements.map((cells, position) => ({
    cells,
    key: `${blockId}-row-${position}`,
  }))
  const caption = context.document.tableAccessibility[blockId]?.caption ?? ''
  const captionId = `table-caption-${blockId}`
  const columnWidth = table.columnWidths.reduce<number>((total, width) => total + (width ?? 0), 0)
  return (
    <div
      className="table-scroll min-w-0 max-w-full my-[1.6em] mx-0 overflow-x-auto rounded-[4px]"
      tabIndex={0}
      role={caption.trim() !== '' ? 'region' : undefined}
      aria-labelledby={caption.trim() !== '' ? captionId : undefined}
    >
      <table style={{ minWidth: `max(100%, ${columnWidth}px)` }}>
        <caption id={captionId}>{caption}</caption>
        <colgroup>
          {columns.map(({ width, key }) => (
            <col key={key} style={typeof width === 'number' ? { width } : undefined} />
          ))}
        </colgroup>
        <tbody>
          {rows.map(({ cells, key }) => (
            <tr key={key}>
              {cells.map(placement => (
                <TableCell
                  key={`${blockId}-${placement.row}-${placement.column}`}
                  placement={placement}
                  table={table}
                  context={context}
                  blockId={blockId}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
