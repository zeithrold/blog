import type { Locator, Page } from '@playwright/test'
import type { Block } from '@/content/document'
import { openDocumentSchema } from '@/content/contracts'
import { writeDocument } from '~/tests/support/browser/document'
import { fixture } from '~/tests/support/browser/document-fixture'
import { horizontalBounds } from '~/tests/support/browser/layout'
import { setLocale } from '~/tests/support/browser/locale'
import { expect, test } from '~/tests/support/browser/test'

const selected = 'Keyboard range'
const suffix = ' untouched suffix'
const pageErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([])
})

async function selectRange(body: Locator, length: number): Promise<void> {
  await body.focus()
  await body.evaluate(async (element, end) => {
    await document.fonts.ready
    const inline = element.querySelector('.bn-inline-content')
    if (inline === null) {
      throw new Error('The input fixture has no inline paragraph')
    }
    const node = document.createTreeWalker(inline, NodeFilter.SHOW_TEXT).nextNode()
    const selection = window.getSelection()
    if (node === null || selection === null) {
      throw new Error('The input fixture has no selectable text')
    }
    const range = document.createRange()
    range.setStart(node, 0)
    range.setEnd(node, end)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  }, length)
}

async function persistedContent(page: Page): Promise<Block['content']> {
  const path = new URL(page.url()).pathname.replace('/admin/documents/', '/api/admin/documents/')
  const response = await page.request.get(path)
  expect(response.ok()).toBe(true)
  const block = openDocumentSchema.parse(await response.json()).document.blocks[0]
  if (block === undefined) {
    throw new Error('The input fixture has no persisted paragraph')
  }
  return block.content
}

async function checkBounds(page: Page, bar: Locator, width: number): Promise<void> {
  await expect(bar).toBeVisible()
  await horizontalBounds(page, bar)
  expect((await bar.boundingBox())?.width).toBeLessThanOrEqual(Math.min(640, width - 24) + 1)
}

test.describe('touch formatting input', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 740 } })

  test('touch taps preserve a partial selection through bold and the mobile color drawer', async ({ page }, info) => {
    await writeDocument(page, fixture(`${selected}${suffix}`))
    await setLocale(page, 'zh')
    const body = page.getByLabel('正文', { exact: true })
    const identity = await body.elementHandle()
    await selectRange(body, selected.length)
    await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString())).toBe(selected)
    const bar = page.getByRole('toolbar', { name: '文字格式', exact: true })
    await checkBounds(page, bar, 390)
    await expect(bar.getByRole('button')).toHaveCount(5)
    await bar.getByRole('button', { name: '加粗', exact: true }).tap()
    await expect.poll(async () => await persistedContent(page), { timeout: 15000 }).toEqual([
      { type: 'text', text: selected, styles: { bold: true } },
      { type: 'text', text: suffix, styles: {} },
    ])
    await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString())).toBe(selected)
    await bar.getByRole('button', { name: '更多格式选项', exact: true }).tap()
    const options = page.getByRole('dialog', { name: '格式选项', exact: true })
    await expect(options).toBeVisible()
    await horizontalBounds(page, options)
    await options.getByRole('button', { name: '颜色', exact: true }).tap()
    const colors = page.getByRole('dialog', { name: '颜色', exact: true })
    await expect(colors).toBeVisible()
    await colors.locator('[data-test="text-color-blue"]').tap()
    await page.screenshot({ path: info.outputPath('touch-formatting-colors-390-zh.png') })
    await colors.getByRole('button', { name: '关闭', exact: true }).tap()
    await expect(colors).not.toBeVisible()
    await expect(body).toBeFocused()
    await expect.poll(async () => await persistedContent(page), { timeout: 15000 }).toEqual([
      { type: 'text', text: selected, styles: { bold: true, textColor: 'blue' } },
      { type: 'text', text: suffix, styles: {} },
    ])
    expect(await identity.evaluate(element => element.isConnected)).toBe(true)
    await page.reload()
    await expect(body.locator('strong')).toHaveText(selected)
    await expect(body.locator('[data-style-type="textColor"][data-value="blue"]')).toHaveText(selected)
    await expect(body).toHaveText(`${selected}${suffix}`)
    expect(await persistedContent(page)).toEqual([
      { type: 'text', text: selected, styles: { bold: true, textColor: 'blue' } },
      { type: 'text', text: suffix, styles: {} },
    ])
    await page.screenshot({ path: info.outputPath('touch-formatting-persisted-390-zh.png') })
  })
})

test('fourteen Shift+ArrowRight presses retain the complete selection and bounded toolbar', async ({ page }, info) => {
  await page.setViewportSize({ width: 701, height: 740 })
  await writeDocument(page, fixture(`${selected}${suffix}`))
  const body = page.getByLabel('Document body', { exact: true })
  await selectRange(body, 0)
  await expect(body).toBeFocused()
  await expect.poll(async () => await page.evaluate(() => {
    const selection = window.getSelection()
    return { text: selection?.toString(), anchor: selection?.anchorOffset, focus: selection?.focusOffset }
  })).toEqual({ text: '', anchor: 0, focus: 0 })
  expect(selected).toHaveLength(14)
  for (let index = 0; index < 14; index++) {
    await page.keyboard.press('Shift+ArrowRight')
  }
  await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString())).toBe(selected)
  await checkBounds(page, page.getByRole('toolbar', { name: 'Formatting', exact: true }), 701)
  await expect(body).toHaveText(`${selected}${suffix}`)
  await page.screenshot({ path: info.outputPath('keyboard-selection-toolbar-701-en.png') })
})
