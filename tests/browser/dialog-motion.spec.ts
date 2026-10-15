import type { Locator } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { settingsTab, writeDocument } from './helpers'
import { fixture } from './preview-history-helpers'

async function centeredFrames(dialog: Locator, state: 'open' | 'closed'): Promise<void> {
  await expect(dialog).toHaveAttribute('data-state', state)
  const frames = await dialog.evaluate((element, currentState) => {
    const name = `ztd-dialog-${currentState === 'open' ? 'enter' : 'exit'}`
    const animation = element.getAnimations().find(candidate =>
      candidate instanceof CSSAnimation && candidate.animationName === name,
    )
    const duration = animation?.effect?.getTiming().duration
    if (animation === undefined || typeof duration !== 'number') {
      throw new Error(`Missing ${currentState} dialog animation`)
    }
    const samples = [
      0,
      duration / 2,
      duration - 1,
    ].map((time) => {
      animation.currentTime = time
      const rect = element.getBoundingClientRect()
      return {
        time,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        expectedX: window.innerWidth / 2,
        expectedY: window.innerHeight / 2,
      }
    })
    animation.finish()
    return samples
  }, state)
  for (const frame of frames) {
    expect(Math.abs(frame.centerX - frame.expectedX), `${state} at ${frame.time}ms: horizontal center`).toBeLessThan(1)
    expect(Math.abs(frame.centerY - frame.expectedY), `${state} at ${frame.time}ms: vertical center`).toBeLessThan(1)
  }
}

for (const width of [390, 1440]) {
  test(`dialog remains centered throughout opening and closing at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await writeDocument(page, fixture('Dialog positioning regression'))
    await settingsTab(page, 'Content')
    // Pause the native CSS animations before opening so their first painted frame is inspectable.
    await page.evaluate(() => {
      const nonce = document.querySelector<HTMLMetaElement>('meta[name="cms-nonce"]')?.content
      if (nonce === undefined || nonce === '') {
        throw new Error('Missing application style nonce')
      }
      const style = document.createElement('style')
      style.nonce = nonce
      style.textContent = '.ztd-dialog { animation-play-state: paused !important; }'
      document.head.append(style)
    })
    const trigger = page.getByRole('button', { name: 'Preview', exact: true })
    await trigger.click()
    const dialog = page.locator('.draft-preview-dialog')
    await expect(dialog).toBeVisible()
    await centeredFrames(dialog, 'open')
    await expect(dialog.getByRole('button', { name: 'Close preview', exact: true })).toBeFocused()
    await dialog.getByRole('button', { name: 'Close preview', exact: true }).click()
    await centeredFrames(dialog, 'closed')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
}
