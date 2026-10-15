import type { Locator, Page } from '@playwright/test'
import type { Document } from '../../src/content/document'
import type { Locale } from './preview-history-helpers'
import { expect } from '@playwright/test'
import { openDocumentSchema } from '../../src/content/contracts'
import { writeDocument } from './helpers'
import { fixture, labels, setLocale } from './preview-history-helpers'

export const linkPrefix = 'Before '
export const linkSelected = 'Selected link'
export const linkSuffix = ' untouched suffix'
export const linkUrl = 'https://example.com/keyboard-link?from=editor#selection'
export const linkCopy = {
  en: { dialog: 'Create link', url: 'Edit URL', cancel: 'Cancel', save: 'Save', more: 'Formatting options' },
  zh: { dialog: '添加链接', url: '编辑链接地址', cancel: '取消', save: '保存', more: '格式选项' },
} as const

export async function linkFixture(page: Page, locale: Locale, width: number): Promise<Locator> {
  await page.setViewportSize({ width, height: 740 })
  await writeDocument(page, fixture(`${linkPrefix}${linkSelected}${linkSuffix}`))
  await setLocale(page, locale)
  return page.getByLabel(labels[locale].body, { exact: true })
}

export async function selectLinkPhrase(page: Page, body: Locator): Promise<void> {
  await body.focus()
  await body.evaluate(async (element, range) => {
    await document.fonts.ready
    const inline = element.querySelector('.bn-inline-content')
    if (inline === null) {
      throw new Error('The keyboard link fixture has no inline paragraph')
    }
    const node = document.createTreeWalker(inline, NodeFilter.SHOW_TEXT).nextNode()
    if (node === null) {
      throw new Error('The keyboard link fixture has no selectable text')
    }
    window.getSelection()?.setBaseAndExtent(node, range.start, node, range.end)
    document.dispatchEvent(new Event('selectionchange'))
  }, { start: linkPrefix.length, end: linkPrefix.length + linkSelected.length })
  await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString())).toBe(linkSelected)
  if (await body.getAttribute('contenteditable') !== 'false') {
    // Wait for native selection state and desktop button effects before sending the shortcut.
    await expect(page.locator('.bn-formatting-toolbar')).toBeVisible()
  }
}

export async function persistedLinkDocument(page: Page): Promise<ReturnType<typeof openDocumentSchema.parse>> {
  const path = new URL(page.url()).pathname.replace('/admin/documents/', '/api/admin/documents/')
  const response = await page.request.get(path)
  expect(response.ok()).toBe(true)
  return openDocumentSchema.parse(await response.json())
}

export async function openKeyboardLink(page: Page, locale: Locale, modifier: 'Control' | 'Meta'): Promise<Locator> {
  await expect(page.getByRole('dialog', { name: linkCopy[locale].more, exact: true })).toHaveCount(0)
  await page.keyboard.press(`${modifier}+k`)
  const url = page.getByRole('textbox', { name: linkCopy[locale].url, exact: true })
  await expect(url).toBeVisible()
  const dialog = page.getByRole('dialog', { name: linkCopy[locale].dialog, exact: true })
  if (await dialog.count() > 0) {
    await expect(dialog).toHaveCSS('opacity', '1')
    await expect.poll(async () => await dialog.evaluate(element =>
      element.getAnimations({ subtree: true }).every(animation =>
        animation.playState === 'finished' || animation.playState === 'idle'),
    )).toBe(true)
  }
  return url
}

export function expectedLinkedDocument(before: Document, url = linkUrl): Document {
  const document = structuredClone(before)
  const block = document.blocks[0]
  if (block === undefined) {
    throw new Error('The keyboard link fixture has no paragraph')
  }
  block.content = [
    { type: 'text', text: linkPrefix, styles: {} },
    {
      type: 'link',
      href: url,
      content: [
        { type: 'text', text: linkSelected, styles: {} },
      ],
    },
    { type: 'text', text: linkSuffix, styles: {} },
  ]
  return document
}

export async function linkSaved(page: Page, locale: Locale): Promise<void> {
  await expect(page.getByRole('status').filter({ hasText: new RegExp(`^${labels[locale].saved}$`) }))
    .toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
}

export async function expectSelectionRestored(page: Page, body: Locator): Promise<void> {
  await expect(body).toBeFocused()
  await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString())).toBe(linkSelected)
}

export async function collapseLinkSelection(page: Page, body: Locator): Promise<void> {
  await selectLinkPhrase(page, body)
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => await page.evaluate(() => window.getSelection()?.isCollapsed)).toBe(true)
}
