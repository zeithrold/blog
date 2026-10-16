import type { Locator, Page } from '@playwright/test'
import { bounds, tableDocument } from '~/tests/browser/editor/tables/table-overlay-helpers'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { writeDocument } from '~/tests/support/browser/document'
import { withinViewport } from '~/tests/support/browser/layout'
import { setChinese } from '~/tests/support/browser/locale'
import { expect, test } from '~/tests/support/browser/test'
import { blockActions, labels, tabToControl } from './block-action-helpers'

async function expectMenuRows(list: Locator, mobile: boolean): Promise<void> {
  const listBox = await bounds(list)
  const buttons = list.getByRole('button')
  await expect(buttons).toHaveCount(4)
  let previousBottom = 0
  for (const button of await buttons.all()) {
    const box = await bounds(button)
    expect(box.y).toBeGreaterThanOrEqual(previousBottom)
    expect(box.x).toBeCloseTo(listBox.x, 0)
    expect(box.width).toBeCloseTo(listBox.width, 0)
    expect(box.height).toBeGreaterThanOrEqual(mobile ? 44 : 36)
    expect(await button.innerText()).not.toBe('')
    await expect(button.locator('svg').first()).toBeVisible()
    await expect(button).toHaveCSS('justify-content', 'flex-start')
    previousBottom = box.y + box.height
  }
}

async function openActions(page: Page, locale: 'en' | 'zh'): Promise<Locator> {
  const table = page.getByLabel(labels[locale].body, { exact: true }).locator('table')
  await table.evaluate(element => element.scrollIntoView({ block: 'center' }))
  await table.getByText('First cell', { exact: true }).hover()
  await page.getByRole('button', { name: labels[locale].menu, exact: true }).click()
  const menu = blockActions(page)
  await expect(menu).toBeVisible()
  await expect(menu).toHaveCSS('opacity', '1')
  await withinViewport(page, menu)
  return menu
}

for (const width of [
  1440,
  390,
  320,
]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`block action menu rows at ${width}px in ${locale}`, async ({ page, browserName }, info) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.setViewportSize({ width, height: 740 })
      await writeDocument(page, tableDocument())
      if (locale === 'zh') {
        await page.getByRole('button', { name: 'Appearance', exact: true }).click()
        await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
        await setChinese(page)
      }
      const menu = await openActions(page, locale)
      const list = menu.locator('.editor-block-action-list')
      await expectMenuRows(list, width <= 700)
      const keyboardHelp = list.getByText(/Alt\+F10/)
      if (width <= 700) {
        await expect(keyboardHelp).toBeHidden()
      }
      else {
        await expect(keyboardHelp).toBeVisible()
      }
      if (locale === 'en' && width !== 320) {
        await assertAccessible(page, info, { label: `block-action-menu-${width}` })
      }
      const remove = list.getByRole('button', { name: labels[locale].remove, exact: true })
      await expect(remove).toBeFocused()
      await tabToControl(page, browserName)
      const colors = list.getByRole('button', { name: labels[locale].colors, exact: true })
      await expect(colors).toBeFocused()
      await expect(colors).toHaveCSS('outline-style', 'none')
      await expect(colors).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      const row = list.getByRole('button', { name: locale === 'en' ? 'Header row' : '行标题', exact: true })
      await expect(row).toHaveAttribute('aria-pressed', 'false')
      await tabToControl(page, browserName)
      await expect(row).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(row).toHaveAttribute('aria-pressed', 'true')
      await expect(row.locator('svg')).toHaveCount(2)
      const column = list.getByRole('button', { name: locale === 'en' ? 'Header column' : '列标题', exact: true })
      await column.click()
      await expect(column).toHaveAttribute('aria-pressed', 'true')
      await expect(column.locator('svg')).toHaveCount(2)
      await page.screenshot({ path: info.outputPath(`block-action-menu-${width}-${locale}.png`) })
      await page.keyboard.press('Escape')
      await expect(menu).not.toBeVisible()
      const table = page.getByLabel(labels[locale].body, { exact: true }).locator('table')
      await expect(table.locator('th')).toHaveCount(3)
      expect(errors).toEqual([])
    })
  }
}
