import { expect, it } from 'vitest'
import { canRemoveTableSegment, tableAxisSpan } from '@/features/editor/blocks/table/table-operations'
import { tableTarget } from './table-support'

it('refuses to remove the only row or column', () => {
  const table = document.createElement('table')
  table.insertRow().insertCell()
  const target = tableTarget('one-cell-table', table)

  expect(tableAxisSpan(target, 'row', 0)).toBe(1)
  expect(canRemoveTableSegment(target, 'row', 0, 1)).toBe(false)
  expect(tableAxisSpan(target, 'column', 0)).toBe(1)
  expect(canRemoveTableSegment(target, 'column', 0, 1)).toBe(false)
})

it('refuses to remove a merged row spanning the final row group', () => {
  const table = document.createElement('table')
  const firstRow = table.insertRow()
  firstRow.insertCell().rowSpan = 2
  firstRow.insertCell()
  table.insertRow().insertCell()
  const target = tableTarget('merged-final-row-group', table)

  expect(tableAxisSpan(target, 'row', 0)).toBe(2)
  expect(canRemoveTableSegment(target, 'row', 0, 2)).toBe(false)
})

it('refuses to remove a merged column spanning the final column group', () => {
  const table = document.createElement('table')
  const firstRow = table.insertRow()
  firstRow.insertCell().colSpan = 2
  const target = tableTarget('merged-final-column-group', table)

  expect(tableAxisSpan(target, 'column', 0)).toBe(2)
  expect(canRemoveTableSegment(target, 'column', 0, 2)).toBe(false)
})
