import { acknowledgementSchema } from '@/contracts/documents'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'
import { labels } from './document-list-boundary-helpers'

test('a late creation response preserves navigation away from the document list', async ({ page }) => {
  await page.goto('/__fixture/login')
  let release = (): void => {}
  let created = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const committed = new Promise<void>((resolve) => {
    created = resolve
  })
  let documentId = ''
  await page.route('**/api/admin/documents', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    const response = await route.fetch()
    documentId = acknowledgementSchema.parse(await response.json()).documentId
    created()
    await held
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'New post', exact: true }).click()
  await committed
  await page.getByRole('link', { name: 'Media library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible()
  const completed = page.waitForResponse(response => response.url().endsWith('/api/admin/documents')
    && response.request().method() === 'POST')
  release()
  expect((await completed).ok()).toBe(true)
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/admin\/media$/)
  await expect(page.getByRole('heading', { name: 'Gallery', exact: true })).toBeVisible()
  expect((await page.request.get(`/api/admin/documents/${documentId}`)).ok()).toBe(true)
})

for (const locale of ['en', 'zh'] as const) {
  test(`120-character ${locale} search chips fit at 320px and can be removed`, async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto('/__fixture/login')
    if (locale === 'zh') {
      await page.getByRole('combobox', { name: 'Language', exact: true }).click()
      await page.getByRole('option', { name: '简体中文', exact: true }).click()
    }
    const copy = labels[locale]
    const search = page.getByRole('searchbox', { name: copy.search, exact: true })
    await search.fill((locale === 'zh' ? '文' : 'W').repeat(120))
    await page.getByRole('button', { name: copy.submit, exact: true }).click()
    const chip = page.getByRole('list', { name: locale === 'zh' ? '已启用的筛选' : 'Active filters', exact: true })
      .getByRole('button')
    await horizontalBounds(page, chip)
    const text = chip.locator('span')
    expect(await text.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
    await expect(text).toHaveCSS('text-overflow', 'ellipsis')
    const icon = chip.locator('svg')
    await expect(icon).toBeVisible()
    await horizontalBounds(page, icon)
    await page.screenshot({ path: info.outputPath(`long-search-${locale}-320.png`) })
    await chip.click()
    await expect(chip).toHaveCount(0)
    await expect(search).toHaveValue('')
    await expect(search).toBeFocused()
  })
}
