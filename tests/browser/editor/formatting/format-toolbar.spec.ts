import type { Locator, Page } from '@playwright/test'
import type { Locale } from '~/tests/support/browser/locale'
import { openDocumentSchema } from '@/content/contracts'
import { tabToControl } from '~/tests/browser/editor/blocks/block-action-helpers'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { labels, setLocale } from '~/tests/support/browser/locale'
import { expect, test } from '~/tests/support/browser/test'
import { copy } from './format-toolbar-copy'

const [selected, suffix] = ['Selected phrase', ' untouched suffix'] as const
const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([])
})
function toolbar(page: Page, locale: Locale): Locator {
  return page.getByRole('toolbar', { name: copy[locale].toolbar, exact: true })
}
async function selectPhrase(page: Page, locale: Locale): Promise<Locator> {
  const body = page.getByLabel(labels[locale].body, { exact: true })
  await body.focus()
  await body.evaluate(async (element, length) => {
    await document.fonts.ready
    const node = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()
    if (node === null) {
      throw new Error('The formatting fixture has no selectable text')
    }
    window.getSelection()?.setBaseAndExtent(node, 0, node, length)
    document.dispatchEvent(new Event('selectionchange'))
  }, selected.length)
  await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString())).toBe(selected)
  await expect(toolbar(page, locale)).toBeVisible()
  await expect(toolbar(page, locale).locator('..')).toHaveCSS('opacity', '1')
  return body
}
async function editorFixture(page: Page, locale: Locale, width: number): Promise<Locator> {
  await page.setViewportSize({ width, height: 740 })
  await writeDocument(page, fixture(`${selected}${suffix}`))
  await setLocale(page, locale)
  return await selectPhrase(page, locale)
}
async function persistedBlock(page: Page) {
  const path = new URL(page.url()).pathname.replace('/admin/documents/', '/api/admin/documents/')
  const response = await page.request.get(path)
  expect(response.ok()).toBe(true)
  const block = openDocumentSchema.parse(await response.json()).document.blocks[0]
  if (block === undefined) {
    throw new Error('The formatting fixture has no paragraph')
  }
  return block
}
async function checkToolbar(page: Page, locale: Locale, width: number): Promise<void> {
  const bar = toolbar(page, locale)
  await horizontalBounds(page, bar)
  expect((await bar.boundingBox())?.width).toBeLessThanOrEqual(Math.min(640, width - 24) + 1)
  const mobile = width <= 700
  const common: string[] = [
    copy[locale].type,
    copy[locale].bold,
    copy[locale].italic,
    copy[locale].underline,
  ]
  if (mobile) {
    common.push(copy[locale].more)
    await expect(bar.getByRole('button')).toHaveCount(5)
  }
  else {
    await expect(bar.getByRole('button', { name: copy[locale].more, exact: true })).toHaveCount(0)
    for (const name of [
      copy[locale].strike,
      copy[locale].colors,
      copy[locale].link,
    ]) {
      await expect(bar.getByRole('button', { name, exact: true })).toBeVisible()
    }
  }
  const row: number[] = []
  for (const name of common) {
    const button = bar.getByRole('button', { name, exact: true })
    await expect(button).toBeVisible()
    const bounds = await button.boundingBox()
    if (bounds !== null && mobile) {
      expect(bounds.width).toBeGreaterThanOrEqual(44)
      expect(bounds.height).toBeGreaterThanOrEqual(44)
      row.push(bounds.y)
    }
  }
  if (mobile) {
    expect(Math.max(...row) - Math.min(...row)).toBeLessThanOrEqual(1)
  }
}
async function openOptions(page: Page, locale: Locale): Promise<Locator> {
  await toolbar(page, locale).getByRole('button', { name: copy[locale].more, exact: true }).click()
  const drawer = page.getByRole('dialog', { name: copy[locale].drawer, exact: true })
  await expect(drawer).toBeVisible()
  await horizontalBounds(page, drawer)
  await expect(drawer.locator('[data-vaul-handle]')).toBeVisible()
  return drawer
}
async function closeOptions(page: Page, locale: Locale): Promise<void> {
  const drawer = page.locator('.formatting-options-drawer')
  if (await drawer.isVisible()) {
    await drawer.getByRole('button', { name: copy[locale].close, exact: true }).click()
  }
  await expect(drawer).not.toBeVisible()
  await selectPhrase(page, locale)
}
for (const width of [
  320,
  390,
  700,
  701,
  1440,
]) {
  for (const locale of ['en', 'zh'] as const) {
    test(`floating formatting is bounded at ${width}px in ${locale} and bold affects only its selected range`, async ({
      page,
    }, info) => {
      const body = await editorFixture(page, locale, width)
      const identity = await body.elementHandle()
      await checkToolbar(page, locale, width)
      await page.screenshot({ path: info.outputPath(`format-toolbar-${width}-${locale}.png`) })
      await toolbar(page, locale).getByRole('button', { name: copy[locale].bold, exact: true }).click()
      await expect.poll(async () => (await persistedBlock(page)).content, { timeout: 15000 }).toEqual([
        { type: 'text', text: selected, styles: { bold: true } },
        { type: 'text', text: suffix, styles: {} },
      ])
      expect(await identity.evaluate(element => element.isConnected)).toBe(true)
      await page.reload()
      await expect(body.locator('strong')).toHaveText(selected)
      await expect(body).toHaveText(`${selected}${suffix}`)
    })
  }
}
async function nativeColorAndLink(page: Page, locale: Locale): Promise<void> {
  let drawer = await openOptions(page, locale)
  await drawer.getByRole('button', { name: copy[locale].colors, exact: true }).click()
  drawer = page.getByRole('dialog', { name: copy[locale].colors, exact: true })
  const blue = drawer.locator('[data-test="text-color-blue"]')
  await expect(blue).toBeVisible()
  await expect(blue).toHaveAccessibleName(copy[locale].blue)
  await horizontalBounds(page, blue)
  expect((await blue.boundingBox())?.width).toBeGreaterThanOrEqual(44)
  expect((await blue.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await blue.click()
  await closeOptions(page, locale)
  drawer = await openOptions(page, locale)
  await drawer.getByRole('button', { name: copy[locale].link, exact: true }).click()
  const url = page.getByRole('textbox', { name: copy[locale].url, exact: true })
  await expect(url).toBeVisible()
  await horizontalBounds(page, url)
  await url.fill('https://example.com/formatting')
  await url.press('Enter')
  await expect.poll(async () => (await persistedBlock(page)).content, { timeout: 15000 }).toEqual([
    {
      type: 'link',
      href: 'https://example.com/formatting',
      content: [
        { type: 'text', text: selected, styles: { strike: true, textColor: 'blue' } },
      ],
    },
    { type: 'text', text: suffix, styles: {} },
  ])
}
for (const scenario of [
  { width: 320, locale: 'zh' },
  { width: 390, locale: 'en' },
] as const) {
  test(`mobile advanced formatting preserves selection and native actions at ${scenario.width}px`, async ({
    page,
    browserName,
  }, info) => {
    const { width, locale } = scenario
    const body = await editorFixture(page, locale, width)
    const identity = await body.elementHandle()
    let drawer = await openOptions(page, locale)
    for (const name of [
      copy[locale].strike,
      copy[locale].colors,
      copy[locale].link,
      copy[locale].center,
      copy[locale].nest,
      copy[locale].unnest,
    ]) {
      await expect(drawer.getByRole('button', { name, exact: true })).toBeVisible()
    }
    await page.screenshot({ path: info.outputPath(`format-options-${width}-${locale}.png`) })
    await page.keyboard.press('Escape')
    await expect(drawer).not.toBeVisible()
    await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString())).toBe(selected)
    const more = toolbar(page, locale).getByRole('button', { name: copy[locale].more, exact: true })
    await more.focus()
    await more.press('Enter')
    drawer = page.getByRole('dialog', { name: copy[locale].drawer, exact: true })
    const strike = drawer.getByRole('button', { name: copy[locale].strike, exact: true })
    await expect(drawer.getByRole('button', { name: copy[locale].close, exact: true })).toBeFocused()
    await tabToControl(page, browserName)
    await expect(strike).toBeFocused()
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await persistedBlock(page)).content, { timeout: 15000 }).toEqual([
      { type: 'text', text: selected, styles: { strike: true } },
      { type: 'text', text: suffix, styles: {} },
    ])
    await closeOptions(page, locale)
    drawer = await openOptions(page, locale)
    await drawer.getByRole('button', { name: copy[locale].center, exact: true }).click()
    await expect.poll(async () => (await persistedBlock(page)).props.textAlignment, { timeout: 15000 }).toBe('center')
    await closeOptions(page, locale)
    await nativeColorAndLink(page, locale)
    expect(await identity.evaluate(element => element.isConnected)).toBe(true)
    await page.reload()
    await expect(body.locator('a[href="https://example.com/formatting"]')).toHaveText(selected)
    await expect(body.locator('s')).toHaveText(selected)
  })
}
test('crossing the mobile breakpoint releases its drawer and retains the editor selection', async ({ page }) => {
  const body = await editorFixture(page, 'en', 700)
  const identity = await body.elementHandle()
  const drawer = await openOptions(page, 'en')
  await page.setViewportSize({ width: 701, height: 740 })
  await expect(drawer).not.toBeVisible()
  await selectPhrase(page, 'en')
  await checkToolbar(page, 'en', 701)
  await page.setViewportSize({ width: 700, height: 740 })
  await selectPhrase(page, 'en')
  await checkToolbar(page, 'en', 700)
  expect(await identity.evaluate(element => element.isConnected)).toBe(true)
})
test.describe('formatting accessibility scanner', () => {
  test.use({ bypassCSP: true, contextOptions: { reducedMotion: 'reduce' } })
  test.beforeEach(async ({ context }) => {
    await context.route('https://fonts.googleapis.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/css',
        headers: { 'access-control-allow-origin': '*' },
        body: '/* Scanner contexts use system font fallbacks. */',
      })
    })
  })
  for (const scenario of [
    { width: 320, locale: 'zh' },
    { width: 1440, locale: 'en' },
  ] as const) {
    test(`formatting controls are accessible at ${scenario.width}px in ${scenario.locale}`, async ({ page }, info) => {
      const { width, locale } = scenario
      await editorFixture(page, locale, width)
      await expect(toolbar(page, locale).locator('..')).toHaveCSS('transition-duration', '0s')
      await assertAccessible(page, info, { label: `format-toolbar-${width}-${locale}` })
      if (width <= 700) {
        const drawer = await openOptions(page, locale)
        await expect.poll(async () => await drawer.evaluate(element => getComputedStyle(element).animationDuration))
          .toBe('0s')
        await assertAccessible(page, info, { label: `format-options-${width}-${locale}` })
      }
    })
  }
})
