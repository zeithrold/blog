import type { Locator, Page } from '@playwright/test'
import type { MountSurfaceOptions } from '~/tests/components/support/mount'
import { READER_CODE_SOURCE, READER_TABLE_CAPTION } from '~/tests/components/src/reader-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'

const unhighlighted = ['text', 'legacy-lang'] as const

async function mountReader(
  page: Page,
  options: Omit<MountSurfaceOptions, 'surface'> = {},
): Promise<Locator> {
  await mountSurface(page, { surface: 'reader-content', ...options })
  const body = page.locator('.reader-body')
  await expect(body).toBeVisible()
  return body
}

async function family(locator: Locator): Promise<string> {
  return await locator.evaluate(element => getComputedStyle(element).fontFamily.replaceAll('"', ''))
}

/** The reader typography contract: one sans scale for headings and mono for code. */
async function assertReaderTypography(root: Locator): Promise<void> {
  const typography = await root.evaluate(element => ({
    sans: getComputedStyle(element).getPropertyValue('--ztd-font-sans').replaceAll('"', '').trim(),
    mono: getComputedStyle(element).getPropertyValue('--ztd-font-mono').replaceAll('"', '').trim(),
    body: Number.parseFloat(getComputedStyle(element).fontSize),
  }))
  expect(typography.sans).not.toBe('')
  expect(typography.mono).not.toBe('')
  const headings = root.locator('[id^="block-"] > :is(h2,h3,h4)')
  await expect(headings).toHaveCount(3)
  for (const heading of await headings.all()) {
    expect(await family(heading)).toBe(typography.sans)
    const size = await heading.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))
    expect(size).toBeGreaterThan(typography.body * 1.15)
    const leading = await heading.evaluate(element => Number.parseFloat(getComputedStyle(element).lineHeight))
    expect(leading).toBeCloseTo(size * 1.35, 2)
  }
  for (const list of await root.locator('ul, ol').all()) {
    const style = await list.evaluate(element => element.tagName === 'OL' ? 'decimal' : 'disc')
    await expect(list).toHaveCSS('list-style-type', style)
  }
  for (const code of await root.locator('pre[data-language]').all()) {
    expect(await family(code)).toBe(typography.mono)
    await expect(code).toHaveCSS('font-size', '14px')
    await expect(code).toHaveCSS('white-space', 'pre')
    await expect(code).toHaveCSS('overflow-wrap', 'normal')
    await expect(code).toHaveCSS('overflow-x', 'auto')
  }
}

for (const language of unhighlighted) {
  test(`reader preserves unhighlighted ${language} source as literal text`, async ({ page }) => {
    const body = await mountReader(page)
    const pre = body.locator(`pre[data-language="${language}"]`)
    expect(await pre.locator('code').textContent()).toBe(READER_CODE_SOURCE)
    await expect(pre.locator('.reader-code-token, img, script')).toHaveCount(0)
    await assertReaderTypography(body)
  })
}

test('article table captions name keyboard-scrollable regions without overflowing the mobile page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await mountReader(page)
  const table = page.getByRole('region', { name: READER_TABLE_CAPTION, exact: true })
  await expect(table.getByRole('table')).toBeVisible()
  expect(await table.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
  await table.focus()
  await expect(table).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => await table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  await page.keyboard.press('ArrowLeft')
  await expect.poll(async () => await table.evaluate(element => element.scrollLeft)).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
