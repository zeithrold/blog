import { expect, test } from '@playwright/test'
import { emptyDocument } from '../../src/content/document'
import { assertAccessible } from './accessibility'
import { setChinese } from './block-action-helpers'
import { settingsTab, writeDocument } from './helpers'

test.use({ timezoneId: 'Asia/Taipei' })

for (const [locale, width] of [
  ['en', 1440],
  ['zh', 390],
] as const) {
  test(`publication timezone is automatic and searchable in ${locale} at ${width}px`, async ({ page }, info) => {
    const initialDocument = emptyDocument()
    initialDocument.meta.title = 'Timezone picker'
    initialDocument.meta.slug = `timezone-picker-${crypto.randomUUID()}`
    await page.setViewportSize({ width, height: 900 })
    await writeDocument(page, initialDocument)
    if (locale === 'zh') {
      await setChinese(page)
      await page.getByRole('button', { name: '文档设置', exact: true }).click()
      await page.getByRole('tab', { name: '发布', exact: true }).click()
    }
    else {
      await settingsTab(page, 'Publication')
    }
    await page.getByRole('button', { name: locale === 'en' ? 'Scheduled publication' : '定时发布', exact: true }).click()
    const timezone = page.getByRole('combobox', {
      name: locale === 'en' ? 'Publication timezone' : '发布时区',
      exact: true,
    })
    await expect(timezone).toContainText('Asia/Taipei')
    await timezone.click()
    const search = page.getByRole('combobox', {
      name: locale === 'en' ? 'Search cities or timezones' : '搜索城市或时区',
      exact: true,
    })
    await expect(search).toBeFocused()
    await search.fill('London')
    await expect(page.locator('.searchable-select-content')).toHaveCSS('opacity', '1')
    await page.screenshot({ path: info.outputPath(`timezone-search-${locale}-${width}.png`) })
    await page.getByRole('option', { name: /Europe\/London$/ }).click()
    await expect(timezone).toContainText('Europe/London')
    await timezone.click()
    await page.getByRole('button', { name: locale === 'en' ? 'Use device timezone' : '使用设备时区', exact: true }).click()
    await expect(timezone).toContainText('Asia/Taipei')
    await timezone.press('Enter')
    await search.fill('UTC')
    await search.press('ArrowDown')
    await search.press('Enter')
    await expect(timezone).toContainText('UTC')
    await timezone.evaluate(element => element.closest('.schedule-time-form')?.scrollIntoView({ block: 'start' }))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await assertAccessible(page, info, { label: `timezone-${locale}-${width}` })
    await page.screenshot({ path: info.outputPath(`timezone-${locale}-${width}.png`) })
  })
}
