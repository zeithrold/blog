import { TABLE_COLUMN_MAX_WIDTH, TABLE_COLUMN_MIN_WIDTH } from '@/content/table-limits'
import { writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'
import { persistedTable } from './table-overlay-helpers'
import { resizeBoundaryColumn, verifyWidthHistoryAndReload, widthBoundaryDocument } from './table-width-limits-helpers'

for (const boundary of [
  { name: 'minimum', width: 1440, drag: -200, result: TABLE_COLUMN_MIN_WIDTH },
  { name: 'maximum', width: 4096, drag: 2100, result: TABLE_COLUMN_MAX_WIDTH },
]) {
  test(`native ${boundary.name} column width saves and remains one Undo`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width: boundary.width, height: 1000 })
    const acknowledgement = await writeDocument(page, widthBoundaryDocument())
    const before = await persistedTable(page, acknowledgement.documentId)
    expect(before.columnWidths).toEqual([
      120,
      180,
      null,
    ])
    await resizeBoundaryColumn(page, boundary.drag)
    await verifyWidthHistoryAndReload(page, acknowledgement.documentId, before, boundary.result)
    expect(errors).toEqual([])
    await page.screenshot({ path: info.outputPath(`table-width-${boundary.name}.png`) })
  })
}
