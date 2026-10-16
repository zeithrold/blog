import { saved, writeDocument } from '~/tests/support/browser/document'
import { withinViewport } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'
import {
  alignedBlockControls,
  bounds,
  cellText,
  checkBars,
  clearOfControls,
  documentTable,
  expectMergedInsertion,
  expectTableControlAppearance,
  expectTableSegments,
  expectTouchTableRows,
  mergedTableDocument,
  persistedTable,
  revealTable,
  tableDocument,
  tableMenu,
  tableScrollbar,
  text,
  undoTable,
} from './table-overlay-helpers'
import {
  editOffscreenColumn,
  verifyMouseTableInsertion,
  verifyNativeColumnResize,
  verifyNativeSlashTable,
  verifyOffscreenColumnFocus,
} from './table-overlay-interaction-helpers'

test('table bars keep row and column menu changes through save and reload', async ({ page }, info) => {
  const acknowledgement = await writeDocument(page, tableDocument())
  const table = await revealTable(page)
  await checkBars(page, table)
  await expectTableControlAppearance(page)
  await expectTableSegments(page, 2, 2)
  const group = page.locator('.editor-side[data-slot="button-group"]')
  await expect(group).toHaveAttribute('data-orientation', 'horizontal')
  await alignedBlockControls(page, group)
  const rowMenu = await tableMenu(page, 'Row', 1)
  expect((await bounds(rowMenu)).width).toBeLessThanOrEqual(240)
  expect(await rowMenu.evaluate(element => getComputedStyle(element).borderColor)).not.toBe('rgb(0, 0, 0)')
  await rowMenu.getByRole('menuitem', { name: 'Add row below', exact: true }).click()
  await expect(table.locator('tr')).toHaveCount(3)
  const columnMenu = await tableMenu(page, 'Column', 2)
  await columnMenu.getByRole('menuitem', { name: 'Add column right', exact: true }).click()
  for (const row of await table.locator('tr').all()) {
    await expect(row.locator('td, th')).toHaveCount(3)
  }
  await saved(page)
  const snapshot = await persistedTable(page, acknowledgement.documentId)
  expect(snapshot.rows).toHaveLength(3)
  expect(snapshot.rows.every(row => row.cells.length === 3)).toBe(true)
  expect(text(snapshot.rows[0]?.cells[0])).toBe('First cell')
  expect(text(snapshot.rows[1]?.cells[0])).toBe('')
  expect(text(snapshot.rows[2]?.cells[1])).toBe('Row 2, column 2')
  await page.reload()
  await expect(documentTable(page).locator('tr')).toHaveCount(3)
  await expect(documentTable(page).getByText('Row 2, column 2', { exact: true })).toBeVisible()
  await revealTable(page)
  await checkBars(page, documentTable(page))
  await page.screenshot({ path: info.outputPath('table-continuous-controls.png') })
  await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
  const blockMenu = page.locator('.editor-desktop-block-actions')
  await expect(blockMenu).toBeVisible()
  await expect(blockMenu).toHaveCSS('opacity', '1')
  expect((await bounds(blockMenu)).width).toBeLessThanOrEqual(240)
  await expect(blockMenu.getByRole('button', { name: 'Header row', exact: true })).toHaveText('Header row')
  expect(await blockMenu.evaluate(element => getComputedStyle(element).borderColor)).not.toBe('rgb(0, 0, 0)')
  await clearOfControls(blockMenu, group)
  await withinViewport(page, blockMenu)
  await page.keyboard.press('Escape')
  await (await tableMenu(page, 'Row', 2)).getByRole('menuitem', { name: 'Delete row', exact: true }).click()
  await (await tableMenu(page, 'Column', 3)).getByRole('menuitem', { name: 'Delete column', exact: true }).click()
  await saved(page)
  const restored = await persistedTable(page, acknowledgement.documentId)
  expect(restored.rows.map(row => row.cells.map(text))).toEqual([
    ['First cell', 'Row 1, column 2'],
    ['Row 2, column 1', 'Row 2, column 2'],
  ])
})

for (const orientation of ['column', 'row'] as const) {
  test(`table ${orientation} insertion covers every boundary and Undo restores cells`, async ({ page }) => {
    const acknowledgement = await writeDocument(page, tableDocument())
    const table = documentTable(page)
    for (const boundary of [
      0,
      1,
      2,
    ]) {
      await revealTable(page)
      const insert = page.locator(`[data-table-insert-${orientation}="${boundary}"]`)
      await expect(insert).toHaveAttribute('aria-label', `Insert ${orientation} at position ${boundary + 1}`)
      await page.keyboard.press('Tab')
      await insert.focus()
      await expect(insert).toBeVisible()
      await expect(insert).toHaveCSS('opacity', '1')
      await insert.press('Enter')
      await expect(table.locator(orientation === 'row' ? 'tr' : 'tr:first-child :is(td, th)')).toHaveCount(3)
      await saved(page)
      const snapshot = await persistedTable(page, acknowledgement.documentId)
      if (orientation === 'column') {
        expect(snapshot.rows.every(row => row.cells.length === 3)).toBe(true)
        for (const [index, row] of snapshot.rows.entries()) {
          const expected = [
            cellText(index, 0),
            cellText(index, 1),
          ]
          expected.splice(boundary, 0, '')
          expect(row.cells.map(text)).toEqual(expected)
        }
      }
      else {
        const expected = [
          ['First cell', 'Row 1, column 2'],
          ['Row 2, column 1', 'Row 2, column 2'],
        ]
        expected.splice(boundary, 0, ['', ''])
        expect(snapshot.rows.map(row => row.cells.map(text))).toEqual(expected)
      }
      const restored = await undoTable(page, acknowledgement.documentId)
      await expect(table.locator(orientation === 'row' ? 'tr' : 'tr:first-child :is(td, th)')).toHaveCount(2)
      expect(restored.rows.map(row => row.cells.map(text))).toEqual([
        ['First cell', 'Row 1, column 2'],
        ['Row 2, column 1', 'Row 2, column 2'],
      ])
    }
  })
}

test('the last table row and column cannot be deleted from the options menus', async ({ page }) => {
  const acknowledgement = await writeDocument(page, tableDocument(1, 1))
  for (const orientation of ['Row', 'Column'] as const) {
    const menu = await tableMenu(page, orientation, 1)
    const deletion = menu.getByRole('menuitem', { name: `Delete ${orientation.toLowerCase()}`, exact: true })
    await expect(deletion).toBeDisabled()
    await page.keyboard.press('Escape')
  }
  await expect(documentTable(page).locator('tr')).toHaveCount(1)
  await expect(documentTable(page).locator('td, th')).toHaveCount(1)
  expect((await persistedTable(page, acknowledgement.documentId)).rows.map(row => row.cells.map(text))).toEqual([
    ['First cell'],
  ])
})

test('native column resizing saves widths and Undo restores the original table', async ({ page }, info) => {
  const acknowledgement = await writeDocument(page, tableDocument())
  await verifyNativeColumnResize(page, acknowledgement.documentId, info.outputPath('table-native-column-resize.png'))
})

for (const width of [1440, 390]) {
  test(`wide table thumb drag and keyboard scrolling work at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    const acknowledgement = await writeDocument(page, tableDocument(4, 8, 220))
    const table = await revealTable(page)
    const viewport = table.locator('xpath=..')
    const scrollbar = await tableScrollbar(page, table)
    await checkBars(page, table)
    await expectTouchTableRows(page, 4, width === 390)
    const maximum = await viewport.evaluate(element => element.scrollWidth - element.clientWidth)
    expect(maximum).toBeGreaterThan(100)
    expect(await viewport.evaluate(element => element.scrollLeft)).toBe(0)
    const firstCellBefore = await bounds(table.locator('td, th').first())
    const thumb = scrollbar.locator('[data-slot="table-scroll-thumb"]')
    const thumbBounds = await bounds(thumb)
    const start = { x: thumbBounds.x + thumbBounds.width / 2, y: thumbBounds.y + thumbBounds.height / 2 }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    try {
      await page.mouse.move(start.x + 20, start.y, { steps: 8 })
    }
    finally {
      await page.mouse.up()
    }
    await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
    const dragged = await viewport.evaluate(element => element.scrollLeft)
    expect(dragged).toBeLessThan(maximum)
    expect((await bounds(table.locator('td, th').first())).x).toBeLessThan(firstCellBefore.x - 1)
    await expect.poll(async () => Number(await scrollbar.getAttribute('aria-valuenow'))).toBeCloseTo(dragged, 0)
    await checkBars(page, table)
    await scrollbar.focus()
    await scrollbar.press('Home')
    await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBe(0)
    await scrollbar.press('ArrowRight')
    await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
    const afterArrowRight = await viewport.evaluate(element => element.scrollLeft)
    await scrollbar.press('ArrowLeft')
    await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBeLessThan(afterArrowRight)
    await scrollbar.press('End')
    await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBeCloseTo(maximum, 0)
    if (width === 390) {
      await table.getByText('Row 1, column 8', { exact: true }).click()
    }
    await expect(page.getByRole('button', { name: 'Column 8 options', exact: true })).toBeInViewport()
    await expect(table.getByText('First cell', { exact: true })).not.toBeInViewport()
    await withinViewport(page, scrollbar)
    await editOffscreenColumn(page, table, acknowledgement.documentId)
    await scrollbar.focus()
    await scrollbar.press('Home')
    await expect.poll(async () => await viewport.evaluate(element => element.scrollLeft)).toBe(0)
    await expect(page.getByRole('button', { name: 'Column 1 options', exact: true })).toBeInViewport()
    if (width === 1440) {
      await verifyOffscreenColumnFocus(page, table)
    }
    await page.screenshot({ path: info.outputPath(`table-scrollbar-${width}.png`) })
    await page.mouse.wheel(0, 120)
    await revealTable(page)
    await checkBars(page, table)
  })
}

test('mobile table grips stay reachable with block actions above the table', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 740 })
  await writeDocument(page, tableDocument())
  const table = await revealTable(page)
  await checkBars(page, table)
  await expectTableControlAppearance(page)
  const group = page.locator('.editor-side[data-slot="button-group"]')
  await expect(group).toHaveAttribute('data-orientation', 'horizontal')
  await group.scrollIntoViewIfNeeded()
  await revealTable(page)
  await expect(group).toBeVisible()
  await withinViewport(page, group)
  await alignedBlockControls(page, group)
  for (const label of ['Row 1 options', 'Column 1 options']) {
    const button = page.getByRole('button', { name: label, exact: true })
    const buttonBounds = await bounds(button)
    expect(Math.min(buttonBounds.width, buttonBounds.height)).toBeGreaterThanOrEqual(44)
  }
  await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
  const blockActions = page.getByRole('dialog', { name: 'Block actions', exact: true })
  await expect(blockActions).toBeVisible()
  await expect(blockActions).toHaveCSS('opacity', '1')
  await withinViewport(page, blockActions)
  await page.screenshot({ path: info.outputPath('table-block-controls-mobile.png') })
  await page.keyboard.press('Escape')
  await expect(table).toBeVisible()
})

for (const orientation of ['column', 'row'] as const) {
  test(`merged ${orientation} controls preserve spans and protect the final group`, async ({ page }) => {
    const acknowledgement = await writeDocument(page, mergedTableDocument(orientation))
    const table = await revealTable(page)
    const before = await persistedTable(page, acknowledgement.documentId)
    const row = orientation === 'row'
    const mergedLabel = row ? 'Rows 1–2 options' : 'Columns 1–2 options'
    const lastLabel = row ? 'Row 3 options' : 'Column 3 options'
    await expect(page.getByRole('button', { name: mergedLabel, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: lastLabel, exact: true })).toBeVisible()
    await expect(page.locator(row ? '.editor-table-row-bar' : '.editor-table-column-bar')
      .getByRole('button', { name: /options$/ })).toHaveCount(2)
    await checkBars(page, table)
    const boundary = page.locator(`[data-table-insert-${orientation}="1"]`)
    await expect(boundary).toHaveAttribute('aria-label', `Insert ${orientation} at position 3`)
    await page.keyboard.press('Tab')
    await boundary.focus()
    await expect(boundary).toHaveCSS('opacity', '1')
    await boundary.press('Enter')
    await saved(page)
    expectMergedInsertion(before, await persistedTable(page, acknowledgement.documentId), orientation)
    expect(await undoTable(page, acknowledgement.documentId)).toEqual(before)
    await revealTable(page)
    await page.getByRole('button', { name: lastLabel, exact: true }).click()
    const menu = page.locator('.bn-table-handle-menu[data-state="open"]')
    await expect(menu).toBeVisible()
    await menu.getByRole('menuitem', { name: `Delete ${orientation}`, exact: true }).click()
    await saved(page)
    const remaining = await persistedTable(page, acknowledgement.documentId)
    expect(row ? remaining.rows.length : remaining.columnWidths.length).toBe(2)
    expect(remaining.rows[0]?.cells[0]).toEqual(before.rows[0]?.cells[0])
    await revealTable(page)
    await page.getByRole('button', { name: mergedLabel, exact: true }).click()
    await expect(menu.getByRole('menuitem', { name: `Delete ${orientation}`, exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    expect(await undoTable(page, acknowledgement.documentId)).toEqual(before)
    await page.reload()
    await revealTable(page)
    await expect(page.getByRole('button', { name: lastLabel, exact: true })).toBeVisible()
    expect(await persistedTable(page, acknowledgement.documentId)).toEqual(before)
  })
}

test('mouse clicks insert a middle column and row and Undo keeps the original cells', async ({ page }) => {
  for (const orientation of ['column', 'row'] as const) {
    const acknowledgement = await writeDocument(page, tableDocument())
    await verifyMouseTableInsertion(page, acknowledgement.documentId, orientation)
  }
})

test('native slash table keeps unset widths through middle insertion and reload', async ({ page }) => {
  await verifyNativeSlashTable(page)
})
