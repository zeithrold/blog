import { assertAccessible } from '~/tests/support/browser/accessibility'
import { expect, test } from '~/tests/support/browser/test'
import { fixture } from './catalog-boundary-helpers'

test.describe('accessibility scanner', () => {
  test.use({ bypassCSP: true })
  test('Chinese dark catalog navigation preserves the draft and returns focus at 320px', async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 900 })
    const { first } = await fixture(page, 'tag')
    await page.getByRole('combobox', { name: 'Language', exact: true }).click()
    await page.getByRole('option', { name: '简体中文', exact: true }).click()
    await page.getByRole('button', { name: '外观', exact: true }).click()
    await page.getByRole('menuitemradio', { name: '深色', exact: true }).click()
    await page.getByRole('button', { name: `编辑 ${first.name}`, exact: true }).click()
    await page.getByLabel('名称', { exact: true }).fill('保留这份未保存修改')
    const trigger = page.getByRole('button', { name: '标签', exact: true })
    await trigger.click()
    await page.getByRole('menuitem', { name: '系列', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '离开目录编辑器？', exact: true })
    await expect(dialog).toContainText('未保存的表单修改将被放弃')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await assertAccessible(page, info, { label: 'catalog-navigation-zh-dark-320' })
    await page.screenshot({ path: info.outputPath('catalog-navigation-zh-dark-320.png') })
    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    await expect(trigger).toBeFocused()
    await expect(page.getByLabel('名称', { exact: true })).toHaveValue('保留这份未保存修改')
    await assertAccessible(page, info, { label: 'catalog-draft-after-cancel-zh-dark-320' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
