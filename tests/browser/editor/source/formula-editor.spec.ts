import type { Locator, Page } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { openDocumentSchema } from '@/contracts/documents'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { draftPreview } from '~/tests/support/browser/preview'
import { expect, test } from '~/tests/support/browser/test'

// The formulas the real editor preview has to lay out: an aligned expression, a tall fraction,
// a matrix and a line wide enough to scroll inside the editor's reading column.
const sources = [
  'x = 123',
  String.raw`\frac{1+\sqrt{1+x^2}}{\frac{a}{b}+\frac{c}{d}}`,
  String.raw`\begin{matrix}a&b\\c&d\end{matrix}`,
  `${'x+'.repeat(69)}x`,
]

// A formula keeps its natural height and never clips: the block grows downwards, the only
// scrolling is horizontal, and a wide line has both of its ends reachable.
async function naturalHeight(formula: Locator): Promise<void> {
  await expect(formula.locator('math')).toBeVisible()
  const geometry = await formula.evaluate((element) => {
    const math = element.querySelector('math')?.getBoundingClientRect()
    const box = element.getBoundingClientRect()
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      containsMath: math !== undefined && math.top >= box.top && math.bottom <= box.bottom,
      overflowY: getComputedStyle(element).overflowY,
    }
  })
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1)
  expect(geometry.containsMath).toBe(true)
  expect(geometry.overflowY).toBe('hidden')
}

async function visibleBounds(element: Locator): Promise<{ x: number, width: number }> {
  const bounds = await element.boundingBox()
  if (bounds === null) {
    throw new Error('Expected a visible formula element')
  }
  return bounds
}

async function reachableEnds(formula: Locator): Promise<void> {
  expect(await formula.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
  await formula.evaluate((element) => {
    element.scrollLeft = 0
  })
  const first = await visibleBounds(formula.locator('mi').first())
  const box = await visibleBounds(formula)
  expect(first.x).toBeGreaterThanOrEqual(box.x)
  expect(first.x + first.width).toBeLessThanOrEqual(box.x + box.width)
  await formula.evaluate((element) => {
    element.scrollLeft = element.scrollWidth
  })
  const last = await visibleBounds(formula.locator('mi').last())
  expect(last.x).toBeGreaterThanOrEqual(box.x)
  expect(last.x + last.width).toBeLessThanOrEqual(box.x + box.width)
}

// The source editor keeps Mod+A inside its own block, so the whole formula is replaced through
// the keyboard path an author uses rather than by assigning text to the DOM.
async function rewriteSource(page: Page, source: Locator, latex: string): Promise<void> {
  await source.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText(latex)
  await expect.poll(async () => await source.textContent()).toBe(latex)
}

async function separateRows(formula: Locator): Promise<void> {
  const rows = formula.locator('math mtr')
  await expect(rows).toHaveCount(2)
  const first = await rows.nth(0).boundingBox()
  const second = await rows.nth(1).boundingBox()
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  expect(second?.y ?? 0).toBeGreaterThan((first?.y ?? 0) + (first?.height ?? 0))
}

async function formulaDocument(page: Page) {
  const document = emptyDocument()
  document.meta.title = 'Formula editing focus'
  document.meta.slug = `formula-focus-${crypto.randomUUID()}`
  return await writeDocument(page, document)
}

for (const width of [1440, 390]) {
  test(`new block formulas receive typing immediately at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const ack = await formulaDocument(page)
    const body = page.getByLabel('Document body', { exact: true })
    await body.pressSequentially('/math')
    const palette = page.getByRole('listbox', { name: 'Insert block', exact: true })
    await expect(palette.getByRole('option', { selected: true }).locator('.editor-option-title'))
      .toHaveText('Formula')
    await body.press('Enter')
    const formula = body.locator('[data-content-type="math"]')
    const source = formula.getByRole('textbox', { name: 'Formula source', exact: true })
    await expect(source).toBeVisible()
    await expect(body).toBeFocused()
    expect(await source.evaluate(element => element.contains(window.getSelection()?.anchorNode ?? null))).toBe(true)
    await page.keyboard.type('x^2+y^2=z^2')
    await expect(source).toHaveText('x^2+y^2=z^2')
    await expect(formula.locator('math')).toContainText('2')
    await expect(formula.locator('.bn-source-block-popup')).toHaveCSS('position', 'static')
    expect(await source.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return box.left >= 0 && box.right <= window.innerWidth
    })).toBe(true)
    const done = formula.getByRole('button', { name: 'Done', exact: true })
    await expect(done).toHaveAttribute('data-slot', 'button')
    await page.screenshot({ path: info.outputPath(`formula-source-${width}.png`) })
    // Every formula keeps its natural height while it is edited and after the editor closes,
    // and the widest one scrolls horizontally with both of its ends reachable.
    for (const [index, latex] of sources.entries()) {
      if (index > 0) {
        await formula.getByRole('button', { name: 'Edit formula', exact: true }).click()
      }
      await rewriteSource(page, source, latex)
      await naturalHeight(formula.locator('.math-display'))
      await done.click()
      await expect(done).toHaveCount(0)
      await expect(formula.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
      await naturalHeight(formula.locator('.math-display'))
      if (index === sources.length - 1) {
        await reachableEnds(formula.locator('.math-display'))
      }
    }
    await expect(source).toHaveCount(0)
    const authored = sources[sources.length - 1] ?? ''
    await saved(page)
    const response = await page.request.get(`/api/admin/documents/${ack.documentId}`)
    const snapshot = openDocumentSchema.parse(await response.json()).document
    expect(snapshot.blocks.find(block => block.type === 'math')?.content)
      .toEqual([
        { type: 'text', text: authored, styles: {} },
      ])
    await page.reload()
    await expect(formula.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
    await expect(formula.locator('math')).toBeVisible()
    // The source block hands the formula the whole preview box instead of clipping it.
    await expect(formula.locator('.bn-preview-container')).toHaveCSS('overflow-y', 'visible')
  })
}

for (const width of [1440, 390]) {
  test(`display formula rows and multiline source roundtrip at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const ack = await formulaDocument(page)
    const body = page.getByLabel('Document body', { exact: true })
    await body.pressSequentially('/math')
    const palette = page.getByRole('listbox', { name: 'Insert block', exact: true })
    await expect(palette.getByRole('option', { selected: true }).locator('.editor-option-title'))
      .toHaveText('Formula')
    await body.press('Enter')
    const formula = body.locator('[data-content-type="math"]')
    const source = formula.getByRole('textbox', { name: 'Formula source', exact: true })
    await expect(source).toBeVisible()
    const blocks = body.locator('.bn-block')
    const count = await blocks.count()
    await page.keyboard.type('x = 123')
    await page.keyboard.press('Enter')
    await page.keyboard.type(String.raw`\\`)
    await page.keyboard.press('Shift+Enter')
    await page.keyboard.type('y = 456')
    const authored = `x = 123\n${String.raw`\\`}\ny = 456`
    await expect.poll(async () => await source.textContent()).toBe(authored)
    await expect(blocks).toHaveCount(count)
    await separateRows(formula)
    await page.screenshot({ path: info.outputPath(`formula-multiline-${width}.png`) })
    await formula.getByRole('button', { name: 'Done', exact: true }).click()
    await saved(page)
    const snapshot = openDocumentSchema.parse(await (await page.request.get(
      `/api/admin/documents/${ack.documentId}`,
    )).json()).document
    expect(snapshot.blocks.find(block => block.type === 'math')?.content)
      .toEqual([
        { type: 'text', text: authored, styles: {} },
      ])
    await page.reload()
    await separateRows(formula)
    await formula.getByRole('button', { name: 'Edit formula', exact: true }).click()
    await expect.poll(async () => await source.textContent()).toBe(authored)
    await formula.getByRole('button', { name: 'Done', exact: true }).click()
    const reader = await draftPreview(page)
    await separateRows(reader)
    await page.screenshot({ path: info.outputPath(`formula-reader-multiline-${width}.png`) })
  })
}
