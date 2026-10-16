import type { Locator, Page } from '@playwright/test'
import type { Document } from '@/content/document'
import type { Styles } from '@/content/inline'
import { expect } from '@playwright/test'
import { fixture } from '~/tests/support/browser/document-fixture'

export const oldLink = 'https://example.com/old'
export const nextLink = 'https://example.com/next'
export const replacementLink = '/posts/replacement#part'

export function adjacentLinks(): Document {
  const document = fixture('')
  const block = document.blocks[0]
  if (block === undefined) {
    throw new Error('Missing paragraph')
  }
  block.content = [
    { type: 'link', href: oldLink, content: [
      { type: 'text', text: 'Alpha', styles: { bold: true } },
    ] },
    { type: 'link', href: nextLink, content: [
      { type: 'text', text: 'Beta', styles: {} },
    ] },
    { type: 'text', text: 'Plain', styles: { italic: true } },
  ]
  return document
}

type Character = { character: string, href: string, styles: Styles }

function textCharacters(text: string, href: string, styles: Styles): Character[] {
  return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), entry => ({
    character: entry.segment,
    href,
    styles,
  }))
}

export function characters(document: Document): Character[] {
  const content = document.blocks[0]?.content
  if (!Array.isArray(content)) {
    throw new TypeError('Missing inline content')
  }
  return content.flatMap((item) => {
    if (item.type === 'link') {
      return item.content.flatMap(text => textCharacters(text.text, item.href, text.styles))
    }
    return item.type === 'text' ? textCharacters(item.text, '', item.styles) : []
  })
}

export async function selectOffsets(page: Page, body: Locator, from: number, to: number): Promise<void> {
  await body.focus()
  await body.evaluate(async (element, offsets) => {
    await document.fonts.ready
    const inline = element.querySelector('.bn-inline-content')
    if (inline === null) {
      throw new Error('Missing inline paragraph')
    }
    const walker = document.createTreeWalker(inline, NodeFilter.SHOW_TEXT)
    const point = (offset: number): { node: Node, offset: number } => {
      walker.currentNode = inline
      let node = walker.nextNode()
      while (node !== null) {
        const length = node.textContent?.length ?? 0
        if (offset <= length) {
          return { node, offset }
        }
        offset -= length
        node = walker.nextNode()
      }
      throw new Error('Selection exceeds the paragraph')
    }
    const start = point(offsets.from)
    const end = point(offsets.to)
    window.getSelection()?.setBaseAndExtent(start.node, start.offset, end.node, end.offset)
    document.dispatchEvent(new Event('selectionchange'))
  }, { from, to })
  await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString()))
    .toBe('AlphaBetaPlain'.slice(from, to))
}
