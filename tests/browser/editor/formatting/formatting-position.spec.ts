import type { Locator, Page } from '@playwright/test'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { setLocale } from '~/tests/support/browser/locale'
import { expect, test } from '~/tests/support/browser/test'

test.use({ video: 'on' })

const errors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', error => messages.push(error.message))
})
test.afterEach(({ page }) => {
  expect(errors.get(page) ?? []).toEqual([])
})

const text = 'A selection that extends across lines follows the current text range. '.repeat(3)
function longDocument(): ReturnType<typeof fixture> {
  const document = fixture(text)
  const original = document.blocks[0]
  if (original === undefined) {
    throw new Error('The position fixture needs a paragraph')
  }
  document.blocks = Array.from({ length: 18 }, () => ({ ...original, id: crypto.randomUUID() }))
  return document
}

async function select(body: Locator, endBlock: number, backward: boolean): Promise<void> {
  await body.evaluate(async (element, options) => {
    await document.fonts.ready
    element.focus({ preventScroll: true })
    const paragraphs = element.querySelectorAll('.bn-inline-content')
    const first = paragraphs[8]
    const last = paragraphs[options.endBlock]
    if (first === undefined || last === undefined) {
      throw new Error('The position fixture needs both selection endpoints')
    }
    const start = document.createTreeWalker(first, NodeFilter.SHOW_TEXT).nextNode()
    const end = document.createTreeWalker(last, NodeFilter.SHOW_TEXT).nextNode()
    if (start === null || end === null) {
      throw new Error('The selection endpoints need text')
    }
    const selection = window.getSelection()
    if (options.backward) {
      selection?.setBaseAndExtent(end, 145, start, 4)
    }
    else {
      selection?.setBaseAndExtent(start, 4, end, 145)
    }
    document.dispatchEvent(new Event('selectionchange'))
  }, { endBlock, backward })
}

async function expectPosition(page: Page, bar: Locator): Promise<void> {
  await expect(bar).toBeVisible()
  await expect(bar.locator('..')).toHaveCSS('opacity', '1')
  await horizontalBounds(page, bar)
  await expect.poll(async () => await bar.evaluate((element) => {
    const selection = window.getSelection()
    if (selection === null || selection.rangeCount === 0) {
      return Number.POSITIVE_INFINITY
    }
    const selected = selection.getRangeAt(0).getBoundingClientRect()
    const bounds = element.getBoundingClientRect()
    return Math.min(Math.abs(bounds.bottom - selected.top), Math.abs(bounds.top - selected.bottom))
  })).toBeLessThan(20)
}

for (const width of [
  700,
  701,
  1024,
]) {
  test(`formatting follows multiline and backward cross-block selections at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: width === 701 ? 'reduce' : 'no-preference' })
    await writeDocument(page, longDocument())
    if (width === 701) {
      await page.getByRole('button', { name: 'Appearance', exact: true }).click()
      await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
      await setLocale(page, 'zh')
    }
    const body = page.getByLabel(width === 701 ? '正文' : 'Document body', { exact: true })
    const bar = page.getByRole('toolbar', { name: width === 701 ? '文字格式' : 'Formatting', exact: true })
    await body.locator('.bn-inline-content').nth(8).evaluate(element =>
      element.scrollIntoView({ block: 'center' }))
    await select(body, 8, false)
    await expectPosition(page, bar)
    const first = await bar.boundingBox()
    expect(first).not.toBeNull()
    await select(body, 9, true)
    await expectPosition(page, bar)
    const selection = await page.evaluate(() => window.getSelection()?.toString())
    expect(selection?.length).toBeGreaterThan(200)
    await page.evaluate(() => window.scrollBy(0, 45))
    await expectPosition(page, bar)
    const resized = width === 700 ? 701 : 700
    await page.setViewportSize({ width: resized, height: 900 })
    await expectPosition(page, bar)
    await expect.poll(async () => {
      const bounds = await bar.boundingBox()
      const header = await page.locator('.workspace-header').boundingBox()
      return bounds !== null && header !== null ? bounds.y - header.y - header.height : -1
    }).toBeGreaterThanOrEqual(7)
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(selection)
    await assertAccessible(page, info, { label: `formatting-position-${width}` })
    await page.screenshot({ path: info.outputPath(`formatting-position-${width}.png`) })
    await page.keyboard.press('Escape')
    await expect(bar).not.toBeVisible()
    await expect(body).toBeFocused()
  })
}

test.describe('native virtual keyboard branch', () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 900 } })

  test('keyboard viewport keeps the native toolbar and returns to selection positioning', async ({ page }, info) => {
    // WebKit emits touch events in this context but reports maxTouchPoints=0.
    // Model coarse touch capability explicitly for this virtual-keyboard branch test.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 })
    })
    await writeDocument(page, fixture(text))
    const body = page.getByLabel('Document body', { exact: true })
    await body.focus()
    await body.evaluate(async (element) => {
      await document.fonts.ready
      const paragraph = element.querySelector('.bn-inline-content')
      const node = paragraph === null ? null : document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT).nextNode()
      if (node === null) {
        throw new Error('The keyboard fixture needs text')
      }
      window.getSelection()?.setBaseAndExtent(node, 0, node, 11)
      document.dispatchEvent(new Event('selectionchange'))
    })
    const bar = page.getByRole('toolbar', { name: 'Formatting', exact: true })
    await expectPosition(page, bar)
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 550 })
      window.visualViewport?.dispatchEvent(new Event('resize'))
    })
    const keyboardBar = page.locator('.bn-mobile-formatting-toolbar')
    await expect(keyboardBar).toBeVisible()
    await horizontalBounds(page, keyboardBar)
    await keyboardBar.getByRole('button', { name: 'Bold', exact: true }).tap()
    await expect(body.locator('strong')).toHaveText('A selection')
    await page.evaluate(() => {
      Reflect.deleteProperty(window.visualViewport ?? {}, 'height')
      window.visualViewport?.dispatchEvent(new Event('resize'))
    })
    await expect(keyboardBar).toHaveCount(0)
    await expectPosition(page, bar)
    await page.screenshot({ path: info.outputPath('formatting-keyboard-restored.png') })
  })
})

test('refocusing during the close animation measures the retained selection again', async ({ page }) => {
  await page.setViewportSize({ width: 701, height: 900 })
  await writeDocument(page, longDocument())
  const body = page.getByLabel('Document body', { exact: true })
  const bar = page.getByRole('toolbar', { name: 'Formatting', exact: true })
  await body.locator('.bn-inline-content').nth(8).evaluate(element =>
    element.scrollIntoView({ block: 'center' }))
  await select(body, 8, false)
  await expectPosition(page, bar)
  const selection = await page.evaluate(() => window.getSelection()?.toString())
  const title = await page.getByRole('textbox', { name: 'Title', exact: true }).elementHandle()
  await body.evaluate(async (element, titleField) => {
    if (!(titleField instanceof HTMLElement)) {
      throw new TypeError('The refocus fixture needs a title field')
    }
    titleField.focus({ preventScroll: true })
    await new Promise(requestAnimationFrame)
    window.scrollBy(0, 45)
    await new Promise(requestAnimationFrame)
    element.focus({ preventScroll: true })
  }, title)
  await expectPosition(page, bar)
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(selection)
})
