import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { emptyDocument } from '../../src/content/document'
import { assertAccessible } from './accessibility'
import { writeDocument } from './helpers'

async function expectIndicatorSpacing(status: Locator): Promise<void> {
  const geometry = await status.evaluate((element) => {
    const glyph = element.querySelector('svg')
    const icon = glyph?.getBoundingClientRect()
    const text = element.querySelector('span')?.getBoundingClientRect()
    if (glyph === null || icon === undefined || text === undefined) {
      throw new Error('Missing loading indicator')
    }
    return {
      gap: text.x - icon.x - icon.width,
      offset: Math.abs(text.y + text.height / 2 - icon.y - icon.height / 2),
      animation: getComputedStyle(glyph).animationName,
    }
  })
  expect(geometry.gap).toBeGreaterThanOrEqual(8)
  expect(geometry.offset).toBeLessThan(2)
  expect(geometry.animation).toBe('none')
}

async function prepareList(page: Page, locale: 'en' | 'zh', width: number): Promise<string> {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const initial = emptyDocument()
  initial.meta.title = `Loading layout ${crypto.randomUUID()}`
  initial.meta.slug = `loading-layout-${crypto.randomUUID()}`
  await writeDocument(page, initial)
  await page.waitForLoadState('networkidle')
  if (locale === 'zh') {
    await page.getByRole('combobox', { name: 'Language', exact: true }).click()
    await page.getByRole('option', { name: '简体中文', exact: true }).click()
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '外观', exact: true }).click()
    await page.getByRole('menuitemradio', { name: '深色', exact: true }).click()
  }
  await page.waitForLoadState('networkidle')
  await page.goto('/admin')
  await expect(page.locator('.document-list')).toBeVisible()
  await page.waitForLoadState('networkidle')
  return initial.meta.title
}

for (const [locale, width] of [
  ['en', 1440],
  ['zh', 320],
] as const) {
  test(`document loading and refresh stay readable in ${locale} at ${width}px`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const title = await prepareList(page, locale, width)
    for (const refresh of [false, true]) {
      let release = (): void => {}
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route(/\/api\/admin\/documents(?:\?|$)/, async (route) => {
        await gate
        await route.continue()
      })
      try {
        if (refresh) {
          await page.getByRole('button', { name: locale === 'en' ? 'Refresh list' : '刷新列表', exact: true }).click()
        }
        else {
          await page.reload()
        }
        const loading = page.locator('.document-loading')
        const status = loading.getByRole('status')
        await expect(status).toHaveText(locale === 'en' ? 'Loading documents…' : '正在加载文档…')
        await expect(page.locator('.document-list-panel')).toHaveAttribute('aria-busy', 'true')
        await expect(loading.locator('.document-skeleton-row')).toHaveCount(refresh ? 0 : 4)
        if (refresh) {
          await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible()
        }
        else {
          await expect(page.locator('.document-list-summary')).not.toContainText(/^0 /)
        }
        await expectIndicatorSpacing(status)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await assertAccessible(page, info, { label: `document-loading-${locale}-${String(refresh)}` })
        await page.screenshot({ path: info.outputPath(`document-loading-${locale}-${String(refresh)}.png`) })
      }
      finally {
        release()
      }
      await expect(page.locator('.document-loading')).toHaveCount(0)
      await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible()
      await page.unroute(/\/api\/admin\/documents(?:\?|$)/)
    }
    await page.waitForLoadState('networkidle')
    expect(errors).toEqual([])
  })
}
