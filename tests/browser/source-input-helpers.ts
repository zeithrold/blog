import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { openDocumentSchema } from '../../src/content/contracts'
import { emptyDocument } from '../../src/content/document'
import { writeDocument } from './helpers'

export type SourceKind = 'math' | 'mermaid'
export const sourceText: Record<SourceKind, string> = { math: 'x=1', mermaid: 'graph TD\nA-->B' }

export function sourceDocument(kind: SourceKind): ReturnType<typeof emptyDocument> {
  const document = emptyDocument()
  document.meta.title = 'Source input boundaries'
  document.meta.slug = `source-input-${crypto.randomUUID()}`
  const paragraph = document.blocks[0]
  if (paragraph === undefined) {
    throw new Error('The source fixture needs a paragraph')
  }
  paragraph.content = [
    { type: 'text', text: 'Keep this paragraph', styles: {} },
  ]
  document.blocks = [
    {
      id: crypto.randomUUID(),
      type: kind,
      props: kind === 'mermaid' ? { description: 'A diagram' } : {},
      content: [
        { type: 'text', text: sourceText[kind], styles: {} },
      ],
      children: [],
    },
    paragraph,
  ]
  return document
}

export async function openSourceFixture(page: Page, kind: SourceKind): Promise<{
  initial: Awaited<ReturnType<typeof writeDocument>>
  body: Locator
  block: Locator
}> {
  const initial = await writeDocument(page, sourceDocument(kind))
  const body = page.getByLabel('Document body', { exact: true })
  const block = body.locator(`[data-content-type="${kind}"]`)
  await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
  return { initial, body, block }
}

export async function selectSourceBlock(page: Page, body: Locator): Promise<void> {
  await body.locator('[data-content-type="paragraph"] .bn-inline-content').evaluate((element) => {
    const editor = element.closest<HTMLElement>('[contenteditable="true"]')
    editor?.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(true)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  await page.keyboard.press('Backspace')
  await expect(body.locator('.ProseMirror-selectednode').first()).toBeVisible()
}

export async function persistedSource(page: Page, id: string): Promise<ReturnType<typeof emptyDocument>> {
  const response = await page.request.get(`/api/admin/documents/${id}`)
  expect(response.ok()).toBe(true)
  return openDocumentSchema.parse(await response.json()).document
}
