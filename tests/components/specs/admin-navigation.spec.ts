import type { Locator, Page } from '@playwright/test'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'

// The admin section the shell is mounted on: its compact navigation labels the
// trigger from the pathname and links to every other section from there.
const route = '/admin/operations'

// Native CSS animations are paused before the menu opens so its first painted
// frame stays inspectable; the harness page has no CSP nonce to copy.
const pausedMenu = '.admin-navigation-menu { animation-play-state: paused !important; }'

async function mountShell(page: Page, options: { width: number, reducedMotion?: 'reduce' }): Promise<void> {
  await page.setViewportSize({ width: options.width, height: 900 })
  await page.emulateMedia({ reducedMotion: options.reducedMotion ?? 'no-preference' })
  await mountSurface(page, { surface: 'admin-navigation', route })
}

async function finishAnimations(menu: Locator): Promise<void> {
  await menu.evaluate(element => element.getAnimations().forEach((animation) => {
    animation.finish()
  }))
}

for (const width of [390, 800]) {
  test(`compact admin menu animates opening and closing at ${width}px`, async ({ page }) => {
    await mountShell(page, { width })
    await page.addStyleTag({ content: pausedMenu })
    const trigger = page.locator('.workspace-navigation-mobile')
    await trigger.click()
    const menu = page.locator('.admin-navigation-menu')
    await expect(menu).toHaveAttribute('data-state', 'open')
    await expect(menu).toHaveCSS('animation-name', 'ztd-menu-enter')
    await expect(menu).toHaveCSS('animation-duration', '0.15s')
    await finishAnimations(menu)
    await page.keyboard.press('Escape')
    await expect(menu).toHaveAttribute('data-state', 'closed')
    await expect(menu).toHaveCSS('animation-name', 'ztd-menu-exit')
    await expect(menu).toHaveCSS('animation-duration', '0.1s')
    await finishAnimations(menu)
    await expect(menu).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
}

// Reduced motion drops the animation but never the keyboard contract: the menu
// still opens onto its first section and gives focus back to its trigger.
test('compact admin menu keeps reduced motion, arrow keys and focus return at 390px', async ({ page }) => {
  await mountShell(page, { width: 390, reducedMotion: 'reduce' })
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

// The compact bar is the only navigation below 1024px, so its trigger has to own
// its vertical space at every phone and tablet width the shell renders.
test('compact admin navigation keeps vertical space around its trigger', async ({ page }, info) => {
  await mountShell(page, { width: 390 })
  for (const width of [
    320,
    390,
    768,
  ]) {
    await page.setViewportSize({ width, height: 844 })
    const navigation = page.getByRole('navigation', { name: 'Admin navigation', exact: true })
    const trigger = navigation.getByRole('button', { name: 'Operations', exact: true })
    await expect(trigger).toBeVisible()
    const insets = await trigger.evaluate((element) => {
      const container = element.closest('nav')?.getBoundingClientRect()
      const button = element.getBoundingClientRect()
      if (container === undefined) {
        throw new Error('Administration navigation is missing')
      }
      return { top: button.top - container.top, bottom: container.bottom - button.bottom }
    })
    expect(insets.top).toBeGreaterThanOrEqual(7)
    expect(insets.bottom).toBeGreaterThanOrEqual(7)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('navigation', { name: 'Admin navigation', exact: true })
    .getByRole('button', { name: 'Operations', exact: true })
    .click()
  await page.screenshot({ path: info.outputPath('compact-admin-navigation.png') })
})
