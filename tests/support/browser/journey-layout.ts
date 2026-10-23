import type { Locator, Page, TestInfo } from '@playwright/test'
import { withinViewport } from './layout'
import { expect } from './test'

// Measurements are task-local observations, never checked-in golden files. Compare only
// regions whose content and viewport are deliberately unchanged between observations.
export type Presentation = {
  width: number
  height: number
  styles: Record<string, string>
  children: {
    tag: string
    text: string
    left: number
    top: number
    width: number
    height: number
    styles: Record<string, string>
  }[]
}

export async function capturePresentation(locator: Locator, info: TestInfo, name: string): Promise<Presentation> {
  await expect(locator).toBeVisible()
  await settle(locator.page())
  const measurement = await locator.evaluate((element) => {
    const styles = (node: Element): Record<string, string> => {
      const css = getComputedStyle(node)
      return Object.fromEntries([
        'display',
        'font-family',
        'font-size',
        'font-weight',
        'line-height',
        'color',
        'background-color',
        'padding',
        'border-radius',
        'border-width',
        'gap',
        'text-align',
        'white-space',
        'overflow-x',
        'overflow-y',
      ].map(property => [
        property,
        css.getPropertyValue(property),
      ]))
    }
    const rect = element.getBoundingClientRect()
    const children = Array.from(element.querySelectorAll('button, a, [role="menuitem"], h1, h2, p'))
      .filter(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden')
      .map((node) => {
        const box = node.getBoundingClientRect()
        return {
          tag: node.tagName,
          text: node.textContent,
          left: box.left - rect.left,
          top: box.top - rect.top,
          width: box.width,
          height: box.height,
          styles: styles(node),
        }
      })
    return { width: rect.width, height: rect.height, styles: styles(element), children }
  })
  await info.attach(`${name}-layout.json`, {
    body: JSON.stringify(measurement, null, 2),
    contentType: 'application/json',
  })
  await info.attach(`${name}.png`, {
    body: await locator.page().screenshot({ animations: 'allow', caret: 'initial' }),
    contentType: 'image/png',
  })
  return measurement
}

export function expectPresentation(actual: Presentation, expected: Presentation | undefined): void {
  expect(expected, 'The initial observation must exist in this task').toBeDefined()
  if (expected === undefined) {
    throw new Error('Missing initial presentation')
  }
  expect(actual.styles, 'Region typography and surface styles').toEqual(expected.styles)
  expect(Math.abs(actual.width - expected.width), 'Region width drift').toBeLessThanOrEqual(1)
  expect(Math.abs(actual.height - expected.height), 'Region height drift').toBeLessThanOrEqual(1)
  expect(actual.children.length, 'Visible content/control count').toBe(expected.children.length)
  for (const [index, node] of actual.children.entries()) {
    const before = expected.children[index]
    if (before === undefined) {
      throw new Error(`Unexpected child ${index}`)
    }
    expect({ tag: node.tag, text: node.text, styles: node.styles }, `Child ${index} presentation`)
      .toEqual({ tag: before.tag, text: before.text, styles: before.styles })
    for (const dimension of [
      'width',
      'height',
      'left',
      'top',
    ] as const) {
      expect(Math.abs(node[dimension] - before[dimension]), `Child ${index} ${dimension} drift`).toBeLessThanOrEqual(1)
    }
  }
}

export async function assertTypography(locator: Locator): Promise<void> {
  // The editor canvas and reader share the product's 17px / 1.65 reading contract.
  const size = 17
  const leading = 1.65
  await expect(locator).toHaveCSS('font-size', `${size}px`)
  await expect.poll(async () => await locator.evaluate(element =>
    Number.parseFloat(getComputedStyle(element).lineHeight)))
    .toBeCloseTo(size * leading, 1)
  await expect(locator).not.toHaveCSS('color', 'rgba(0, 0, 0, 0)')
}

export async function assertUsable(locator: Locator, minimum: number): Promise<void> {
  await expect(locator).toBeVisible()
  await expect(locator).toBeEnabled()
  await expect.poll(async () => await locator.evaluate((element, min) => {
    const bounds = element.getBoundingClientRect()
    const x = bounds.left + bounds.width / 2
    const y = bounds.top + bounds.height / 2
    const hit = document.elementFromPoint(x, y)
    return bounds.width >= min && bounds.height >= min && element.scrollWidth <= element.clientWidth + 1
      && hit !== null && element.contains(hit)
  }, minimum), { message: 'Control must meet its size contract and receive unobstructed pointer hits' }).toBe(true)
}

export async function expectReleased(page: Page, trigger: Locator): Promise<void> {
  const overlays = page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible, [role="menu"]:visible')
  await expect(overlays).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect.poll(async () => await page.evaluate(() => {
    const body = getComputedStyle(document.body)
    const root = getComputedStyle(document.documentElement)
    return body.pointerEvents !== 'none' && body.overflowY !== 'hidden'
      && root.overflowY !== 'hidden' && !document.body.hasAttribute('data-scroll-locked')
  }), { message: 'Closing the final overlay must release page scrolling and pointer input' }).toBe(true)
  await assertUsable(trigger, 44)
}

export async function assertPageLayout(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  expect(overflow, 'No page-level horizontal overflow').toBe(false)
  const modal = page.locator([
    '[role="dialog"][aria-modal="true"]:visible',
    '[role="alertdialog"][aria-modal="true"]:visible',
  ].join(', ')).last()
  if (await modal.count() > 0) {
    await expect.poll(async () => await modal.evaluate(element => element.contains(document.activeElement)), {
      message: 'The active modal must own keyboard focus',
    }).toBe(true)
  }
  const overlays = page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible, [role="menu"]:visible')
  for (const overlay of await overlays.all()) {
    await withinViewport(page, overlay)
    await expect(overlay).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  }
  if (await overlays.count() === 0) {
    await expect.poll(async () => await page.evaluate(() => {
      const body = getComputedStyle(document.body)
      return body.pointerEvents !== 'none' && body.overflowY !== 'hidden'
        && !document.body.hasAttribute('data-scroll-locked')
    }), { message: 'No modal scroll/pointer lock may survive an overlay' }).toBe(true)
  }
}

export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(document.getAnimations().filter(animation =>
      animation.effect?.getComputedTiming().iterations !== Infinity)
      .map(async animation => await animation.finished.catch(() => {})))
    await Promise.all(Array.from(document.images).filter((image) => {
      const box = image.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight
    })
      .map(async image => await image.decode().catch(() => {})))
  })
}
