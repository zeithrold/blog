import { expect, test } from '@playwright/test'

for (const width of [390, 800]) {
  test(`admin section menu animates opening and closing at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/__fixture/login')
    await page.evaluate(() => {
      const nonce = document.querySelector<HTMLMetaElement>('meta[name="cms-nonce"]')?.content
      if (nonce === undefined || nonce === '') {
        throw new Error('Missing application style nonce')
      }
      const style = document.createElement('style')
      style.nonce = nonce
      style.textContent = '.admin-navigation-menu { animation-play-state: paused !important; }'
      document.head.append(style)
    })
    const trigger = page.locator('.workspace-navigation-mobile')
    await trigger.click()
    const menu = page.locator('.admin-navigation-menu')
    await expect(menu).toHaveAttribute('data-state', 'open')
    await expect(menu).toHaveCSS('animation-name', 'ztd-menu-enter')
    await expect(menu).toHaveCSS('animation-duration', '0.15s')
    await expect(menu.getByRole('menuitem', { name: 'Media library', exact: true })).toBeVisible()
    await menu.evaluate(element => element.getAnimations().forEach((animation) => {
      animation.finish()
    }))
    await page.keyboard.press('Escape')
    await expect(menu).toHaveAttribute('data-state', 'closed')
    await expect(menu).toHaveCSS('animation-name', 'ztd-menu-exit')
    await expect(menu).toHaveCSS('animation-duration', '0.1s')
    await menu.evaluate(element => element.getAnimations().forEach((animation) => {
      animation.finish()
    }))
    await expect(menu).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
}

test('admin section menu respects reduced motion and keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/__fixture/login')
  const trigger = page.locator('.workspace-navigation-mobile')
  await trigger.focus()
  await trigger.press('Enter')
  const menu = page.locator('.admin-navigation-menu')
  await expect(menu).toHaveCSS('animation-name', 'none')
  await expect(menu.getByRole('menuitem', { name: 'Documents', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem', { name: 'Media library', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
