import type { Locator, Page } from '@playwright/test'
import type { ComponentLocale, ComponentMode } from '../src/contract'
import type { ApiService } from './http-fixtures'
import type { Block } from '@/content/document'
import { expect } from '@playwright/test'
import { z } from 'zod'
import { horizontalBounds } from '~/tests/support/browser/layout'
import {
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceApi,
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
  paragraphBlock,
} from './editor-workspace-fixtures'
import { serveApi } from './http-fixtures'
import { mountSurface } from './mount'

/**
 * Remaining formatting coverage on the real editor entry.
 *
 * These helpers drive the same production BlockNote toolbar, options drawer,
 * colour matrix and link entry the E2E suite drove, but against the component
 * harness' explicit HTTP boundary. A case asserts the revision packet, the
 * rendered geometry and the retained selection; stored reload stays a small E2E
 * representative.
 */

/** The labels the formatting toolbar, drawer and colour matrix answer to. */
export const remainingCopy = {
  en: {
    body: 'Document body',
    toolbar: 'Formatting',
    type: 'Block type',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    more: 'More formatting options',
    drawer: 'Formatting options',
    close: 'Close',
    strike: 'Strike',
    colors: 'Colors',
    link: 'Create link',
    url: 'Edit URL',
    blue: 'Blue',
    center: 'Align text center',
    nest: 'Nest block',
    unnest: 'Unnest block',
  },
  zh: {
    body: '正文',
    toolbar: '文字格式',
    type: '块类型',
    bold: '加粗',
    italic: '斜体',
    underline: '下划线',
    more: '更多格式选项',
    drawer: '格式选项',
    close: '关闭',
    strike: '删除线',
    colors: '颜色',
    link: '添加链接',
    url: '编辑链接地址',
    blue: '蓝色',
    center: '居中',
    nest: '嵌套',
    unnest: '取消嵌套',
  },
} as const

/** The paragraph text the multiline and viewport cases scroll through. */
export const longParagraphText
  = 'A selection that extends across lines follows the current text range. '.repeat(3)

/** The link URL the colour-and-link case applies to the retained range. */
export const formattingLink = 'https://example.com/formatting'

export type FormattingOpen = { readonly api: ApiService, readonly body: Locator }

/** `count` identical native paragraphs, each with its own block id. */
export function repeatedParagraphs(text: string, count: number): Block[] {
  return Array.from({ length: count }, () => paragraphBlock(text))
}

/** The 18-paragraph document the cross-block and refocus cases select inside. */
export function longParagraphs(): Block[] {
  return repeatedParagraphs(longParagraphText, 18)
}

/**
 * Mounts the production editor entry on the supplied native blocks in the
 * requested locale and appearance. The real editor loads its own session and
 * document, so the case answers those reads and the revision write here.
 */
export async function openFormatting(
  page: Page,
  blocks: readonly Block[],
  locale: ComponentLocale = 'en',
  mode: ComponentMode = 'light',
): Promise<FormattingOpen> {
  const open = editorWorkspaceDocument('Formatting interaction', (document) => {
    document.blocks = [
      ...blocks,
    ]
  })
  const api = await serveApi(page, {
    ...editorWorkspaceApi(open),
    'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
  })
  await mountSurface(page, {
    surface: 'editor-workspace',
    locale,
    mode,
    route: `/admin/documents/${EDITOR_WORKSPACE_DOCUMENT_ID}`,
  })
  const body = page.getByLabel(remainingCopy[locale].body, { exact: true })
  await expect(body).toBeVisible()
  return { api, body }
}

/** The toolbar the retained selection opens. */
export function formattingToolbar(page: Page, locale: ComponentLocale): Locator {
  return page.getByRole('toolbar', { name: remainingCopy[locale].toolbar, exact: true })
}

/** Selects the leading range of the first paragraph, leaving later text untouched. */
export async function selectLeadingRange(
  page: Page,
  body: Locator,
  length: number,
  expected: string,
): Promise<void> {
  await body.focus()
  await body.evaluate(async (element, end) => {
    await document.fonts.ready
    const inline = element.querySelector('.bn-inline-content')
    const node = inline === null ? null : document.createTreeWalker(inline, NodeFilter.SHOW_TEXT).nextNode()
    if (node === null) {
      throw new Error('The formatting fixture has no selectable text')
    }
    window.getSelection()?.setBaseAndExtent(node, 0, node, end)
    document.dispatchEvent(new Event('selectionchange'))
  }, length)
  await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString()))
    .toBe(expected)
}

/**
 * Checks the floating toolbar's horizontal bounds and its control inventory at
 * `width`: the compact layout keeps five 44px touch targets on one row, while the
 * wide layout exposes strike, colours and the link entry and drops the More menu.
 */
export async function checkToolbar(page: Page, locale: ComponentLocale, width: number): Promise<void> {
  const copy = remainingCopy[locale]
  const bar = formattingToolbar(page, locale)
  await horizontalBounds(page, bar)
  expect((await bar.boundingBox())?.width).toBeLessThanOrEqual(Math.min(640, width - 24) + 1)
  const mobile = width <= 700
  const common: string[] = [
    copy.type,
    copy.bold,
    copy.italic,
    copy.underline,
  ]
  if (mobile) {
    common.push(copy.more)
    await expect(bar.getByRole('button')).toHaveCount(5)
  }
  else {
    await expect(bar.getByRole('button', { name: copy.more, exact: true })).toHaveCount(0)
    for (const name of [
      copy.strike,
      copy.colors,
      copy.link,
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

/** Opens the compact advanced options drawer and returns its settled content. */
export async function openOptions(page: Page, locale: ComponentLocale): Promise<Locator> {
  const copy = remainingCopy[locale]
  await formattingToolbar(page, locale)
    .getByRole('button', { name: copy.more, exact: true })
    .click()
  const drawer = page.getByRole('dialog', { name: copy.drawer, exact: true })
  await expect(drawer).toBeVisible()
  await horizontalBounds(page, drawer)
  await expect(drawer.locator('[data-vaul-handle]')).toBeVisible()
  return drawer
}

/** Closes the options drawer if it is still open. */
export async function closeOptions(page: Page, locale: ComponentLocale): Promise<void> {
  const drawer = page.locator('.formatting-options-drawer')
  if (await drawer.isVisible()) {
    await drawer.getByRole('button', { name: remainingCopy[locale].close, exact: true }).click()
  }
  await expect(drawer).not.toBeVisible()
}

/** Applies the blue text colour, then wraps the same range in a link. */
export async function applyColorAndLink(page: Page, body: Locator, locale: ComponentLocale): Promise<void> {
  const copy = remainingCopy[locale]
  let drawer = await openOptions(page, locale)
  await drawer.getByRole('button', { name: copy.colors, exact: true }).click()
  const colors = page.getByRole('dialog', { name: copy.colors, exact: true })
  const blue = colors.locator('[data-test="text-color-blue"]')
  await expect(blue).toBeVisible()
  await expect(blue).toHaveAccessibleName(copy.blue)
  await horizontalBounds(page, blue)
  const bounds = await blue.boundingBox()
  expect(bounds?.width).toBeGreaterThanOrEqual(44)
  expect(bounds?.height).toBeGreaterThanOrEqual(44)
  await blue.click()
  await closeOptions(page, locale)
  await selectLeadingRange(page, body, 'Selected phrase'.length, 'Selected phrase')
  drawer = await openOptions(page, locale)
  await drawer.getByRole('button', { name: copy.link, exact: true }).click()
  const url = page.getByRole('textbox', { name: copy.url, exact: true })
  await expect(url).toBeVisible()
  await horizontalBounds(page, url)
  await url.fill(formattingLink)
  await url.press('Enter')
}

/**
 * Asserts the floating toolbar is showing and that one of its edges sits next to
 * the current selection within the documented 20px tolerance.
 */
export async function expectFormattingPosition(page: Page, bar: Locator): Promise<void> {
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

/**
 * Selects between the ninth paragraph and `endBlock`, forwards or backwards, the
 * way a pointer drag across lines would leave the native range.
 */
export async function selectAcrossBlocks(body: Locator, endBlock: number, backward: boolean): Promise<void> {
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

/**
 * Advances focus with Tab, using Option+Tab on macOS WebKit so buttons join the
 * tab order exactly as the platform presents them.
 */
export async function tabToControl(page: Page, browserName: string): Promise<void> {
  await page.keyboard.press(`${browserName === 'webkit' ? 'Alt+' : ''}Tab`)
}

const packetSchema = z.object({
  document: z.object({
    blocks: z.array(z.object({
      props: z.record(z.string(), z.unknown()).optional(),
    })),
  }),
})

/** Reads the first block's stored properties from the latest revision packet. */
function lastPacketProps(api: ApiService): Record<string, unknown> | undefined {
  const writes = api.calls.filter(call => call.method === 'PUT')
  const parsed = packetSchema.safeParse(writes.at(-1)?.json)
  return parsed.success ? parsed.data.document.blocks[0]?.props : undefined
}

/** Waits for the revision packet's first block to carry the expected alignment. */
export async function expectPacketAlignment(api: ApiService, alignment: string): Promise<void> {
  await expect.poll(() => lastPacketProps(api)?.textAlignment, { timeout: 15000 }).toBe(alignment)
}
