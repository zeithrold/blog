import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'
import { blockAction, blockActions, paragraph, reveal } from './block-action-helpers'
import {
  documentBlocks,
  documentLayout,
  expectControlsInBlockGap,
  expectMobileBlockSpacing,
  firstNestedGapItem,
  gapDocument,
  hideBlockControls,
  topLevelBlocks,
} from './mobile-block-gap-helpers'

for (const width of [390, 320]) {
  test(`mobile blocks use full width and stable control gaps at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await writeDocument(page, gapDocument())
    await page.evaluate(async () => await document.fonts.ready)
    const stored = await documentBlocks(page)
    await expectMobileBlockSpacing(page)
    const layout = await documentLayout(page)
    for (const index of [1, 4]) {
      const block = await reveal(page, index)
      await expectControlsInBlockGap(page, block)
      expect(await documentLayout(page)).toEqual(layout)
      await page.screenshot({ path: info.outputPath(`block-gap-${width}-${index}.png`) })
      await hideBlockControls(page)
      expect(await documentLayout(page)).toEqual(layout)
    }
    const nested = firstNestedGapItem(page)
    await nested.evaluate(element => element.scrollIntoView({ block: 'center' }))
    await nested.hover()
    await expectControlsInBlockGap(page, nested)
    expect(await documentLayout(page)).toEqual(layout)
    await hideBlockControls(page)
    expect(await documentBlocks(page)).toEqual(stored)
    await page.reload()
    await expectMobileBlockSpacing(page)
    expect(await documentBlocks(page)).toEqual(stored)
  })
}

test.describe('touch controls in the block gap', () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 900 } })

  test('the gap add control inserts after its block and deletion preserves its neighbours', async ({ page }, info) => {
    await writeDocument(page, gapDocument())
    const original = await documentBlocks(page)
    await paragraph(page, 1).tap()
    await expectControlsInBlockGap(page, paragraph(page, 1))
    const add = page.getByRole('button', { name: 'Add block', exact: true })
    // The outer touch target must work beyond the smaller visible button background.
    await add.tap({ position: { x: 2, y: 2 } })
    const suggestions = page.getByRole('listbox', { name: 'Insert block', exact: true })
    await expect(suggestions).toBeVisible()
    await suggestions.getByRole('option', { name: /^Heading 1/ }).tap()
    await page.getByLabel('Document body', { exact: true }).pressSequentially('Inserted in this gap')
    await saved(page)
    const inserted = await documentBlocks(page)
    expect(inserted).toHaveLength(5)
    expect(inserted[0]).toEqual(original[0])
    expect(inserted[1]?.type).toBe('heading')
    expect(inserted[1]?.content).toEqual([
      { type: 'text', text: 'Inserted in this gap', styles: {} },
    ])
    expect(inserted.slice(2)).toEqual(original.slice(1))
    const heading = page.locator('.bn-block-content[data-content-type="heading"]')
    await heading.tap()
    await expectControlsInBlockGap(page, heading)
    await page.getByRole('button', { name: 'Open block menu', exact: true }).tap()
    await expect(blockActions(page)).toBeVisible()
    await blockAction(page, 'en', 'remove').tap()
    await saved(page)
    await expect.poll(async () => await documentBlocks(page)).toEqual(original)
    const nested = firstNestedGapItem(page)
    await nested.tap()
    await expectControlsInBlockGap(page, nested)
    await page.getByRole('button', { name: 'Open block menu', exact: true }).tap()
    await blockAction(page, 'en', 'remove').tap()
    await saved(page)
    const expected = structuredClone(original)
    const parent = expected[2]
    if (parent === undefined) {
      throw new Error('The nested action fixture has no parent block')
    }
    parent.children = parent.children.slice(1)
    await expect.poll(async () => await documentBlocks(page)).toEqual(expected)
    await page.reload()
    await expect(topLevelBlocks(page)).toHaveCount(4)
    expect(await documentBlocks(page)).toEqual(expected)
    await paragraph(page, 1).tap()
    await expectControlsInBlockGap(page, paragraph(page, 1))
    await page.screenshot({ path: info.outputPath('touch-gap-insertion-and-deletion-320.png') })
  })
})
