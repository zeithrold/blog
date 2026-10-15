import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { openDocumentSchema } from '../../src/content/contracts'
import {
  blockAction,
  blockActions,
  blockText,
  fixture,
  labels,
  paragraph,
  reveal,
  setChinese,
  tabToControl,
  withinViewport,
} from './block-action-helpers'
import { writeDocument } from './helpers'

type Locale = 'en' | 'zh'
const colorLabels = {
  en: { text: 'Text', background: 'Background', close: 'Close' },
  zh: { text: '文本', background: '背景色', close: '关闭' },
} as const

const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([])
})

async function openTouchActions(page: Page, index: number, locale: Locale): Promise<Locator> {
  const block = paragraph(page, index)
  await block.scrollIntoViewIfNeeded()
  await block.tap()
  const handle = page.getByRole('button', { name: labels[locale].menu, exact: true })
  await expect(handle).toBeVisible()
  await withinViewport(page, handle)
  await handle.tap()
  const drawer = blockActions(page)
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('[data-vaul-handle]')).toBeVisible()
  await withinViewport(page, drawer)
  const bounds = await drawer.boundingBox()
  expect(bounds?.width).toBeGreaterThanOrEqual((page.viewportSize()?.width ?? 0) - 4)
  expect(bounds?.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) * 0.9 + 2)
  expect(await drawer.evaluate((element) => {
    const box = element.getBoundingClientRect()
    return Math.abs(box.bottom - window.innerHeight)
  })).toBeLessThanOrEqual(2)
  for (const action of ['remove', 'colors'] as const) {
    const button = blockAction(page, locale, action)
    await expect(button.locator('svg').first()).toBeVisible()
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  }
  await expect(page.locator('.editor-desktop-block-actions')).toHaveCount(0)
  return drawer
}

async function openTouchColors(page: Page, index: number, locale: Locale): Promise<Locator> {
  const drawer = blockActions(page)
  if (!await drawer.isVisible()) {
    await openTouchActions(page, index, locale)
  }
  const colors = blockAction(page, locale, 'colors')
  if (await colors.isVisible()) {
    await colors.tap()
  }
  await expect(drawer.locator('[data-test="text-color-red"]')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.locator('.bn-color-picker-dropdown')).toHaveCount(0)
  await withinViewport(page, drawer)
  return drawer
}

async function persistedColors(page: Page, documentId: string, target: string): Promise<unknown> {
  const response = await page.request.get(`/api/admin/documents/${documentId}`)
  expect(response.ok()).toBe(true)
  const document = openDocumentSchema.parse(await response.json()).document
  return document.blocks.map(block => ({
    id: block.id,
    textColor: block.props.textColor,
    backgroundColor: block.props.backgroundColor,
  })).filter(block => block.id === target)
}

async function checkColorChoices(drawer: Locator, locale: Locale): Promise<void> {
  const text = drawer.getByRole('group', { name: colorLabels[locale].text, exact: true })
  const background = drawer.getByRole('group', { name: colorLabels[locale].background, exact: true })
  await expect(text).toBeVisible()
  await expect(background).toBeVisible()
  await expect(text.locator('[data-test^="text-color-"]')).toHaveCount(10)
  await expect(background.locator('[data-test^="background-color-"]')).toHaveCount(10)
  for (const color of await drawer.locator('[data-test*="-color-"]').all()) {
    const size = await color.boundingBox()
    expect(size?.width).toBeGreaterThanOrEqual(44)
    expect(size?.height).toBeGreaterThanOrEqual(44)
  }
}

test.describe('touch block colors', () => {
  test.use({ hasTouch: true })
  for (const width of [320, 390]) {
    for (const locale of ['en', 'zh'] as const) {
      test(`color drawer fits ${width}px in ${locale} and persists both colors on the selected block`, async ({
        page,
      }, info) => {
        await page.setViewportSize({ width, height: 740 })
        const document = fixture(3)
        const target = document.blocks[1]?.id
        if (target === undefined) {
          throw new Error('The color fixture is missing its target block')
        }
        const created = await writeDocument(page, document)
        if (locale === 'zh') {
          await setChinese(page)
        }
        const body = page.getByLabel(labels[locale].body, { exact: true })
        const identity = await body.elementHandle()
        await openTouchActions(page, 2, locale)
        let drawer = await openTouchColors(page, 2, locale)
        await checkColorChoices(drawer, locale)
        const red = drawer.locator('[data-test="text-color-red"]')
        await red.tap()
        await expect(paragraph(page, 2)).toHaveAttribute('data-text-color', 'red')
        drawer = await openTouchColors(page, 2, locale)
        const yellow = drawer.locator('[data-test="background-color-yellow"]')
        await yellow.tap()
        await expect(paragraph(page, 2)).toHaveAttribute('data-background-color', 'yellow')
        drawer = await openTouchColors(page, 2, locale)
        await expect(drawer.locator('[data-test="text-color-red"]')).toHaveAttribute('aria-pressed', 'true')
        await expect(drawer.locator('[data-test="background-color-yellow"]')).toHaveAttribute('aria-pressed', 'true')
        await withinViewport(page, drawer)
        await page.screenshot({ path: info.outputPath(`block-color-drawer-${width}-${locale}.png`) })
        await drawer.getByRole('button', { name: colorLabels[locale].close, exact: true }).tap()
        await expect(drawer).not.toBeVisible()
        await expect(body).toBeFocused()
        expect(await identity.evaluate(element => element.isConnected)).toBe(true)
        await expect.poll(async () => await persistedColors(page, created.documentId, target), {
          timeout: 15000,
        }).toEqual([
          { id: target, textColor: 'red', backgroundColor: 'yellow' },
        ])
        await page.reload()
        await expect(paragraph(page, 2)).toHaveAttribute('data-text-color', 'red')
        await expect(paragraph(page, 2)).toHaveAttribute('data-background-color', 'yellow')
        for (const index of [1, 3]) {
          await expect(paragraph(page, index)).not.toHaveAttribute('data-text-color', 'red')
          await expect(paragraph(page, index)).not.toHaveAttribute('data-background-color', 'yellow')
        }
        await expect(body).toContainText(blockText(2))
      })
    }
  }
})

test('color drawers keep focus and release the editor on Escape and desktop resize', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await writeDocument(page, fixture(3))
  const body = page.getByLabel('Document body', { exact: true })
  const identity = await body.elementHandle()
  await reveal(page, 2)
  const handle = page.getByRole('button', { name: 'Open block menu', exact: true })
  await handle.focus()
  await handle.press('Enter')
  const drawer = blockActions(page)
  const remove = blockAction(page, 'en', 'remove')
  await expect(remove).toBeFocused()
  await tabToControl(page, browserName)
  await expect(blockAction(page, 'en', 'colors')).toBeFocused()
  await page.keyboard.press('Enter')
  const first = drawer.locator('[data-test="text-color-default"]')
  await expect(drawer.getByRole('button', { name: 'Back', exact: true })).toBeFocused()
  await tabToControl(page, browserName)
  await expect(first).toBeFocused()
  const close = drawer.getByRole('button', { name: 'Close', exact: true })
  await close.focus()
  await tabToControl(page, browserName)
  expect(await drawer.evaluate(element => element.contains(document.activeElement))).toBe(true)
  await expect(drawer.getByRole('button', { name: 'Back', exact: true })).toBeFocused()
  await tabToControl(page, browserName, true)
  await expect(close).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible()
  await expect(body).toBeFocused()
  expect(await identity.evaluate(element => element.isConnected)).toBe(true)
  await reveal(page, 2)
  await handle.click()
  await blockAction(page, 'en', 'colors').click()
  await expect(drawer.locator('[data-test="text-color-red"]')).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(drawer).not.toBeVisible()
  expect(await identity.evaluate(element => element.isConnected)).toBe(true)
  await reveal(page, 2)
  await handle.click()
  const menu = page.locator('.editor-desktop-block-actions')
  await expect(menu).toBeVisible()
  await withinViewport(page, menu)
  await menu.getByRole('button', { name: 'Colors', exact: true }).click()
  const colors = menu
  await expect(colors).toBeVisible()
  await withinViewport(page, colors)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(body).toContainText(blockText(2))
})

test('desktop block actions show icons and keep matrix color selection and persistence', async ({ page }) => {
  const document = fixture(3)
  const target = document.blocks[1]?.id
  if (target === undefined) {
    throw new Error('The desktop color fixture is missing its target block')
  }
  const created = await writeDocument(page, document)
  await reveal(page, 2)
  await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
  const menu = page.locator('.editor-desktop-block-actions')
  for (const action of ['Delete', 'Colors']) {
    await expect(menu.getByRole('button', { name: action, exact: true }).locator('svg').first()).toBeVisible()
  }
  await menu.getByRole('button', { name: 'Colors', exact: true }).click()
  const colors = menu
  await expect(colors).toBeVisible()
  await withinViewport(page, colors)
  await colors.locator('[data-test="text-color-blue"]').click()
  await expect(paragraph(page, 2)).toHaveAttribute('data-text-color', 'blue')
  await expect.poll(async () => await persistedColors(page, created.documentId, target), {
    timeout: 15000,
  }).toEqual([
    { id: target, textColor: 'blue', backgroundColor: 'default' },
  ])
  await page.reload()
  await expect(paragraph(page, 2)).toHaveAttribute('data-text-color', 'blue')
  await expect(paragraph(page, 1)).not.toHaveAttribute('data-text-color', 'blue')
  await expect(paragraph(page, 3)).not.toHaveAttribute('data-text-color', 'blue')
})
