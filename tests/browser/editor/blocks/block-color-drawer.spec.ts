import type { Page } from '@playwright/test'
import { openDocumentSchema } from '@/contracts/documents'
import { writeDocument } from '~/tests/support/browser/document'
import { withinViewport } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'
import {
  blockText,
  checkColorChoices,
  colorLabels,
  fixture,
  labels,
  openTouchActions,
  openTouchColors,
  paragraph,
} from './block-action-helpers'

const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([])
})

async function persistedColors(page: Page, documentId: string, target: string): Promise<unknown> {
  const response = await page.request.get(`/api/admin/documents/${documentId}`)
  expect(response.ok()).toBe(true)
  const document = openDocumentSchema.parse(await response.json()).document
  return document.blocks.map(block => ({
    id: block.id,
    textColor: block.props.textColor,
    backgroundColor: block.props.backgroundColor,
  })).filter(block => block.id === target)
}

/**
 * The one stored-color representative for the block suite. The production
 * Worker keeps both color properties on the selected block, the neighbors stay
 * untouched and the reload renders them. The drawer geometry, swatch matrix and
 * focus behavior are proved against the real component by
 * `tests/components/specs/editor-block-remaining.spec.ts`.
 */
test.describe('touch block colors', () => {
  test.use({ hasTouch: true })
  test('color drawer fits 320px in en and persists both colors on the selected block', async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 320, height: 740 })
    const document = fixture(3)
    const target = document.blocks[1]?.id
    if (target === undefined) {
      throw new Error('The color fixture is missing its target block')
    }
    const created = await writeDocument(page, document)
    const body = page.getByLabel(labels.en.body, { exact: true })
    const identity = await body.elementHandle()
    await openTouchActions(page, 2, 'en')
    let drawer = await openTouchColors(page, 2, 'en')
    await checkColorChoices(drawer, 'en')
    const red = drawer.locator('[data-test="text-color-red"]')
    await red.tap()
    await expect(paragraph(page, 2)).toHaveAttribute('data-text-color', 'red')
    drawer = await openTouchColors(page, 2, 'en')
    const yellow = drawer.locator('[data-test="background-color-yellow"]')
    await yellow.tap()
    await expect(paragraph(page, 2)).toHaveAttribute('data-background-color', 'yellow')
    drawer = await openTouchColors(page, 2, 'en')
    await expect(drawer.locator('[data-test="text-color-red"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(drawer.locator('[data-test="background-color-yellow"]')).toHaveAttribute('aria-pressed', 'true')
    await withinViewport(page, drawer)
    await page.screenshot({ path: info.outputPath('block-color-drawer-320-en.png') })
    await drawer.getByRole('button', { name: colorLabels.en.close, exact: true }).tap()
    await expect(drawer).not.toBeVisible()
    await expect(body).toBeFocused()
    expect(await identity.evaluate(element => element.isConnected)).toBe(true)
    await expect.poll(async () => await persistedColors(page, created.documentId, target), {
      timeout: 15000,
    }).toEqual([
      { id: target, textColor: 'red', backgroundColor: 'yellow' },
    ])
    await page.reload()
    await expect(paragraph(page, 2)).toHaveAttribute('data-text-color', 'red')
    await expect(paragraph(page, 2)).toHaveAttribute('data-background-color', 'yellow')
    for (const index of [1, 3]) {
      await expect(paragraph(page, index)).not.toHaveAttribute('data-text-color', 'red')
      await expect(paragraph(page, index)).not.toHaveAttribute('data-background-color', 'yellow')
    }
    await expect(body).toContainText(blockText(2))
  })
})
