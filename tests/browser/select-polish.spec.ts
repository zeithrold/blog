import type { Locator } from '@playwright/test'
import { expect, test } from '@playwright/test'

async function checkOptionLayout(options: Locator): Promise<void> {
  const geometry = await options.evaluateAll((rows) => {
    return rows.map((row) => {
      const text = row.querySelector<HTMLElement>(':scope > span[id]')
      const indicator = row.querySelector<HTMLElement>(':scope > span[aria-hidden="true"]')
      if (text === null) {
        throw new Error('Select option has no item text')
      }
      const bounds = row.getBoundingClientRect()
      const mark = indicator?.getBoundingClientRect()
      return {
        textInset: text.getBoundingClientRect().left - bounds.left,
        textPosition: getComputedStyle(text).position,
        outline: getComputedStyle(row).outlineStyle,
        checkInset: mark === undefined ? null : bounds.right - mark.right,
        checkCenter: mark === undefined ? null : Math.abs((mark.top + mark.bottom - bounds.top - bounds.bottom) / 2),
      }
    })
  })
  expect(geometry.length).toBeGreaterThan(1)
  for (const row of geometry) {
    expect(row.textPosition).toBe('static')
    expect(row.textInset).toBeGreaterThanOrEqual(11)
    expect(row.textInset).toBeLessThanOrEqual(13)
    expect(row.outline).toBe('none')
    if (row.checkInset !== null) {
      expect(row.checkInset).toBeGreaterThanOrEqual(11)
      expect(row.checkInset).toBeLessThanOrEqual(13)
      expect(row.checkCenter).toBeLessThanOrEqual(1)
    }
  }
  expect(geometry.filter(row => row.checkInset !== null)).toHaveLength(1)
}

test('Select options retain one text gutter, show a centered right check and animate in and out', async ({
  page,
}, info) => {
  await page.goto('/__fixture/login')
  const type = page.getByRole('combobox', { name: 'Document type', exact: true })
  await type.click()
  const menu = page.locator('.choice-select-content[data-state="open"]')
  await expect(menu).toHaveAttribute('data-side', 'bottom')
  expect(await menu.evaluate(node => getComputedStyle(node).animationName)).toBe('ztd-menu-enter')
  await checkOptionLayout(page.getByRole('option'))
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'Post', exact: true })).toBeFocused()
  await page.screenshot({ path: info.outputPath('select-aligned-options.png') })

  const exitAnimation = await menu.evaluateHandle((node) => {
    const state = { animation: '' }
    const observer = new MutationObserver(() => {
      if (node.getAttribute('data-state') === 'closed') {
        observer.disconnect()
        state.animation = getComputedStyle(node).animationName
      }
    })
    observer.observe(node, { attributes: true, attributeFilter: ['data-state'] })
    return state
  })
  await page.keyboard.press('Escape')
  await expect.poll(async () => await exitAnimation.evaluate(state => state.animation)).toBe('ztd-menu-exit')
  await exitAnimation.dispose()
  await expect(page.locator('.choice-select-content')).toHaveCount(0)
  await expect(type).toBeFocused()

  await page.getByRole('combobox', { name: 'Language', exact: true }).click()
  await checkOptionLayout(page.getByRole('option'))
  const localeMenu = page.locator('.ztd-locale-menu[data-state="open"]')
  expect(await localeMenu.evaluate(node => getComputedStyle(node).animationName)).toBe('ztd-menu-enter')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  const choices = page.getByRole('menuitemradio')
  const checked = choices.filter({ has: page.locator('.ztd-indicator') })
  await expect(checked).toHaveCount(2)
  expect(await checked.evaluateAll(nodes => nodes.every((node) => {
    const indicator = node.querySelector('.ztd-indicator')
    if (indicator === null) {
      return false
    }
    return Math.abs(node.getBoundingClientRect().right - indicator.getBoundingClientRect().right - 12) <= 1
  }))).toBe(true)
})

test('compact Select keeps options aligned and respects reduced motion', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/__fixture/login')
  await page.getByRole('combobox', { name: 'Language', exact: true }).click()
  await page.getByRole('option', { name: '简体中文', exact: true }).click()
  const type = page.getByRole('combobox', { name: '文档类型', exact: true })
  await type.click()
  await checkOptionLayout(page.getByRole('option'))
  const menu = page.locator('.choice-select-content[data-state="open"]')
  expect(await menu.evaluate(node => getComputedStyle(node).animationName)).toBe('none')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('select-mobile-reduced-motion.png') })
  await page.keyboard.press('Escape')
  await expect(type).toBeFocused()
  await page.getByRole('combobox', { name: '语言', exact: true }).click()
  await checkOptionLayout(page.getByRole('option'))
  const localeMenu = page.locator('.ztd-locale-menu[data-state="open"]')
  expect(await localeMenu.evaluate(node => getComputedStyle(node).animationName)).toBe('none')
})
