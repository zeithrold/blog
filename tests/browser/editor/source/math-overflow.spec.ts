import type { Locator } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { draftPreview } from '~/tests/support/browser/preview'
import { expect, test } from '~/tests/support/browser/test'

const sources = [
  'x = 123',
  String.raw`\frac{1+\sqrt{1+x^2}}{\frac{a}{b}+\frac{c}{d}}`,
  String.raw`\begin{matrix}a&b\\c&d\end{matrix}`,
  `${'x+'.repeat(69)}x`,
]

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

async function visibleBounds(element: Locator): Promise<{ x: number, width: number }> {
  const bounds = await element.boundingBox()
  if (bounds === null) {
    throw new Error('Expected a visible formula element')
  }
  return bounds
}

for (const width of [1440, 390]) {
  test(`formula previews keep natural height and reachable horizontal content at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const document = emptyDocument()
    document.meta.title = 'Formula natural height'
    document.blocks.unshift(...sources.map(source => ({
      id: crypto.randomUUID(),
      type: 'math' as const,
      props: {},
      content: [
        { type: 'text' as const, text: source, styles: {} },
      ],
      children: [],
    })))
    await writeDocument(page, document)
    const blocks = page.getByLabel('Document body', { exact: true }).locator('[data-content-type="math"]')
    for (let index = 0; index < sources.length; index++) {
      const block = blocks.nth(index)
      const nativePreview = block.locator('.bn-preview-container')
      await expect(nativePreview).toHaveCSS('overflow-y', 'visible')
      await naturalHeight(block.locator('.math-display'))
    }
    await reachableEnds(blocks.last().locator('.math-display'))
    await blocks.nth(1).getByRole('button', { name: 'Edit formula', exact: true }).click()
    const sourceEditor = blocks.nth(1).getByRole('textbox', { name: 'Formula source', exact: true })
    await expect(sourceEditor).toHaveText(sources[1] ?? '')
    await naturalHeight(blocks.nth(1).locator('.math-display'))
    await page.screenshot({ path: info.outputPath(`formula-natural-height-${width}.png`) })
    await blocks.nth(1).getByRole('button', { name: 'Done', exact: true }).click()
    await saved(page)
    const reader = await draftPreview(page)
    const formulas = reader.locator('.math-display')
    await expect(formulas).toHaveCount(sources.length)
    for (let index = 0; index < sources.length; index++) {
      await naturalHeight(formulas.nth(index))
    }
    await reachableEnds(formulas.last())
    await page.screenshot({ path: info.outputPath(`formula-reader-natural-height-${width}.png`) })
  })
}
