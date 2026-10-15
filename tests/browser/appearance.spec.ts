import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { openDocumentSchema } from '../../src/content/contracts'
import { assertAccessible } from './accessibility'
import { saved } from './helpers'

const palettes = [
  'Neutral',
  'Terracotta',
  'Moss',
  'Ocean',
  'Plum',
  'Graphite',
]
const chinesePalettes = [
  '中性',
  '暖陶',
  '苔绿',
  '海蓝',
  '莓紫',
  '石墨',
]
async function choose(page: Page, chinese: boolean, name: string): Promise<void> {
  await page
    .getByRole('button', { name: chinese ? '外观' : 'Appearance', exact: true })
    .click()
  await page.getByRole('menuitemradio', { name, exact: true }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
}
async function scanModes(page: Page, info: TestInfo, chinese: boolean): Promise<void> {
  for (const mode of chinese
    ? [
        '浅色',
        '深色',
        '跟随系统',
      ]
    : [
        'Light',
        'Dark',
        'System',
      ]) {
    await choose(page, chinese, mode)
    for (const palette of chinese ? chinesePalettes : palettes) {
      await choose(page, chinese, palette)
      await assertAccessible(page, info, {
        label: `${chinese ? 'zh' : 'en'}-${mode}-${palette}`,
      })
    }
  }
}
test.describe('accessibility scanner', () => {
  test.use({ bypassCSP: true })
  test('36 bilingual appearance states preserve the editor and have no axe violations', async ({
    page,
  }, info) => {
    test.slow()
    await page.goto('/__fixture/login')
    await page.getByRole('button', { name: 'New post' }).click()
    const body = page.getByLabel('Document body', { exact: true })
    await body.fill('Appearance state native English 中文')
    await saved(page)
    const identity = await body.elementHandle()
    const path = new URL(page.url()).pathname.replace(
      '/admin/documents/',
      '/api/admin/documents/',
    )
    const before = openDocumentSchema.parse(await (await page.request.get(path)).json())
    await scanModes(page, info, false)
    await page.getByRole('combobox', { name: 'Language', exact: true }).click()
    await page.getByRole('option', { name: '简体中文', exact: true }).click()
    await expect(page.getByText('文档设置', { exact: true })).toBeVisible()
    await scanModes(page, info, true)
    expect(await identity.evaluate(element => element.isConnected)).toBe(true)
    await expect(body).toContainText('Appearance state native English 中文')
    const after = openDocumentSchema.parse(await (await page.request.get(path)).json())
    expect(after.headRevisionId).toBe(before.headRevisionId)
  })
})
