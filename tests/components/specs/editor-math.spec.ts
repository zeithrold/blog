import type { Locator } from '@playwright/test'
import { EDITOR_MATH_SOURCES } from '../support/editor-fixtures'
import { mountSurface } from '../support/mount'
import { expect, test } from '../support/test'

// A formula keeps its natural height and never clips: the block grows downwards, the only
// scrolling is horizontal, and a wide line has both of its ends reachable.
async function naturalHeight(formula: Locator): Promise<void> {
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

for (const width of [1440, 390]) {
  test(`formula previews keep natural height and reachable horizontal content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mountSurface(page, { surface: 'editor-math' })
    const formulas = page.locator('.math-display')
    for (let index = 0; index < EDITOR_MATH_SOURCES.length; index++) {
      await naturalHeight(formulas.nth(index))
    }
    await reachableEnds(formulas.last())
  })
}
