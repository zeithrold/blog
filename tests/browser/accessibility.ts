import type { Page, TestInfo } from '@playwright/test'
import { assertAccessible as scanAccessible } from '@ztd-me/frontend-checks/playwright'

export async function assertAccessible(
  page: Page,
  info: TestInfo,
  options: Parameters<typeof scanAccessible>[2],
): Promise<void> {
  // Compare the settled surface; a fading overlay blends colors during entry.
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming()
      return animation.playState === 'running' && timing?.iterations !== Infinity
    })
    await Promise.all(finite.map(async animation => await animation.finished.catch(() => {})))
  })
  await scanAccessible(page, info, options)
}
