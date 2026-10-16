import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function horizontalBounds(page: Page, locator: Locator): Promise<void> {
  await expect.poll(async () => await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return bounds.left >= 0 && bounds.right <= window.innerWidth
  })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

export async function withinViewport(page: Page, locator: Locator): Promise<void> {
  // Drawers animate from below the screen; assess their settled bounds.
  await expect.poll(async () => await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return {
      left: bounds.left >= 0,
      right: bounds.right <= window.innerWidth,
      top: bounds.top >= 0,
      bottom: bounds.bottom <= window.innerHeight,
    }
  })).toEqual({ left: true, right: true, top: true, bottom: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}
