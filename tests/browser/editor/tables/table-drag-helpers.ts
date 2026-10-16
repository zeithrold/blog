import type { CDPSession, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { bounds } from './table-overlay-helpers'

export type Point = { x: number, y: number }

export async function startMouseDrag(page: Page, orientation: 'row' | 'column', index = 0): Promise<Point> {
  const handle = page.locator(`[data-table-control-${orientation}="${index}"]`)
  const box = await bounds(handle)
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  return point
}

export async function moveMouseDrag(page: Page, point: Point): Promise<void> {
  await page.mouse.move(point.x, point.y, { steps: 6 })
  await expect(page.locator('[data-table-drag-preview]')).toBeVisible()
  await expect(page.locator('.bn-table-handle-menu[data-state="open"]')).toHaveCount(0)
  await expect(page.locator('.editor-overlays .editor-side')).toBeHidden()
}

type TouchType = 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel'

export async function touchPoint(session: CDPSession, type: TouchType, point: Point): Promise<void> {
  await session.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' || type === 'touchCancel'
      ? []
      : [
          { ...point, id: 1 },
        ],
  })
}
