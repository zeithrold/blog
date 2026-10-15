import type { Cell, Table } from '@/content/table-schema'
import { requireContent } from '@/content/base'

export type CellPlacement = {
  cell: Cell
  row: number
  column: number
  rows: number
  cols: number
  offset: number
}

function spans(cell: Cell): {
  rows: number
  cols: number
} {
  return Array.isArray(cell)
    ? {
        rows: 1,
        cols: 1,
      }
    : {
        rows: cell.props.rowspan ?? 1,
        cols: cell.props.colspan ?? 1,
      }
}
function mark(matrix: boolean[][], item: CellPlacement, width: number): void {
  requireContent(
    item.column >= 0
    && item.column + item.cols <= width
    && item.row + item.rows <= matrix.length,
  )
  for (let y = item.row; y < item.row + item.rows; y++) {
    for (let x = item.column; x < item.column + item.cols; x++) {
      const line = matrix[y]
      requireContent(line !== undefined && line[x] === false)
      line[x] = true
    }
  }
}
export function tableLayout(value: Table): CellPlacement[][] {
  const width = value.columnWidths.length
  const occupied = Array.from(
    {
      length: value.rows.length,
    },
    () =>
      Array.from<boolean>({
        length: width,
      }).fill(false),
  )
  requireContent(
    (value.headerRows ?? 0) <= value.rows.length && (value.headerCols ?? 0) <= width,
  )
  let offset = 0
  return value.rows.map((row, y) => {
    requireContent(
      row.cells.every(cell => Array.isArray(cell))
      || row.cells.every(cell => !Array.isArray(cell)),
    )
    let cursor = 0
    const placed = row.cells.map((cell) => {
      const column = occupied[y]?.findIndex((used, index) => index >= cursor && !used) ?? -1
      const item = {
        cell,
        row: y,
        column,
        offset,
        ...spans(cell),
      }
      mark(occupied, item, width)
      cursor = column + item.cols
      offset += (Array.isArray(cell) ? cell : cell.content).length
      return item
    })
    requireContent(occupied[y]?.every(Boolean) === true)
    return placed
  })
}
export function validateTable(value: Table): void {
  tableLayout(value)
}
