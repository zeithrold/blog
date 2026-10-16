import { writeDocument } from '~/tests/support/browser/document'
import { withinViewport } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'
import { persistedTable, tableDocument } from './table-overlay-helpers'

for (const width of [390, 1440]) {
  test(`table formatting preserves its range below the selection at ${width}px`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    const initial = await writeDocument(page, tableDocument())
    const body = page.getByLabel('Document body', { exact: true })
    await body.focus()
    const cell = body.getByRole('cell').first()
    await cell.evaluate(element => element.scrollIntoView({ block: 'center' }))
    await cell.evaluate(async (element) => {
      await document.fonts.ready
      const node = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()
      if (node === null) {
        throw new Error('The table fixture needs cell text')
      }
      window.getSelection()?.setBaseAndExtent(node, 0, node, 5)
      document.dispatchEvent(new Event('selectionchange'))
    })
    await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString())).toBe('First')
    const bar = page.getByRole('toolbar', { name: 'Formatting', exact: true })
    await expect(bar).toBeVisible()
    await expect(bar.locator('..')).toHaveCSS('opacity', '1')
    await withinViewport(page, bar)
    await expect.poll(async () => await bar.evaluate((element) => {
      const selection = window.getSelection()
      if (selection === null || selection.rangeCount === 0) {
        return -1
      }
      return element.getBoundingClientRect().top - selection.getRangeAt(0).getBoundingClientRect().bottom
    })).toBeGreaterThanOrEqual(7)
    await bar.getByRole('button', { name: 'Italic', exact: true }).click()
    await expect.poll(async () => {
      const savedCell = (await persistedTable(page, initial.documentId)).rows[0]?.cells[0]
      return Array.isArray(savedCell) ? savedCell : savedCell?.content
    }, {
      timeout: 15000,
    }).toEqual([
      { type: 'text', text: 'First', styles: { italic: true } },
      { type: 'text', text: ' cell', styles: {} },
    ])
    await page.reload()
    await expect(body.getByRole('cell').first().locator('em')).toHaveText('First')
    await expect(body.getByRole('cell').nth(1)).toHaveText('Row 1, column 2')
    await page.screenshot({ path: info.outputPath(`formatting-table-${width}.png`) })
    expect(errors).toEqual([])
  })
}
