import type { Locator, Page } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { openDocumentSchema } from '@/contracts/documents'
import { writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'

async function arrowSource(page: Page, type: 'math' | 'mermaid') {
  const document = emptyDocument()
  const source = type === 'math' ? 'a^2' : 'graph TD\nA-->B'
  document.meta.title = 'Visible source navigation'
  document.meta.slug = `source-navigation-${crypto.randomUUID()}`
  const paragraph = document.blocks[0]
  if (paragraph === undefined) {
    throw new Error('Missing paragraph')
  }
  paragraph.content = [
    { type: 'text', text: 'Keep this paragraph', styles: {} },
  ]
  document.blocks.unshift({
    id: crypto.randomUUID(),
    type,
    props: type === 'mermaid' ? { description: 'Live diagram' } : {},
    content: [
      { type: 'text', text: source, styles: {} },
    ],
    children: [],
  })
  const ack = await writeDocument(page, document)
  const body = page.getByLabel('Document body', { exact: true })
  const paragraphInput = body.locator('[data-content-type="paragraph"] .bn-inline-content')
  // Establish real pointer focus before placing the caret. ProseMirror repairs a
  // synthetic focus's native selection asynchronously, which can race ArrowUp.
  await paragraphInput.click()
  await paragraphInput.evaluate((element) => {
    const range = window.document.createRange()
    range.selectNodeContents(element)
    range.collapse(true)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    window.document.dispatchEvent(new Event('selectionchange'))
  })
  await expect.poll(async () => await selectionPosition(body)).toMatchObject({
    type: 'paragraph',
    offset: 0,
    anchor: 'Keep this paragraph',
    focused: true,
  })
  await page.keyboard.press('ArrowUp')
  const block = body.locator(`[data-content-type="${type}"]`)
  const popup = block.locator('.bn-preview-with-source-popup')
  await expect(popup).toHaveAttribute('data-open', 'true')
  const position = await selectionPosition(body)
  expect(position.type).toBe(type)
  expect(position.focused).toBe(true)
  return { ack, source, body, block, popup, position }
}
async function selectionPosition(body: Locator) {
  return await body.evaluate((element) => {
    const selection = window.getSelection()
    return {
      type: selection?.anchorNode?.parentElement?.closest('[data-content-type]')?.getAttribute('data-content-type'),
      offset: selection?.anchorOffset,
      anchor: selection?.anchorNode?.textContent,
      focused: window.document.activeElement === element,
    }
  })
}
for (const type of ['math', 'mermaid'] as const) {
  test(`${type} keeps complete typing after Arrow navigation reveals its source`, async ({ page }) => {
    const { source, body, block, popup, position, ack } = await arrowSource(page, type)
    const expected = `${source.slice(0, position.offset)}xyz${source.slice(position.offset)}`
    await page.keyboard.type('xyz')
    await expect(block.locator('code[aria-label]')).toHaveText(expected)
    await expect(body).toBeFocused()
    await expect.poll(async () => {
      const response = await page.request.get(`/api/admin/documents/${ack.documentId}`)
      return openDocumentSchema.parse(await response.json()).document.blocks[0]?.content
    }, { timeout: 15000 }).toEqual([
      { type: 'text', text: expected, styles: {} },
    ])
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(popup).toHaveAttribute('data-open', 'false')
  })
  test(`${type} Tab reaches its next control without nesting the block`, async ({ page }) => {
    const { source, block, popup, ack } = await arrowSource(page, type)
    await page.keyboard.press('Tab')
    const next = type === 'math' ? block.getByRole('button', { name: 'Done', exact: true }) : block.locator('input')
    await expect(next).toBeFocused()
    await expect(block.locator('code[aria-label]')).toHaveText(source)
    const response = await page.request.get(`/api/admin/documents/${ack.documentId}`)
    expect(openDocumentSchema.parse(await response.json()).document.blocks).toHaveLength(2)
    await block.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(popup).toHaveAttribute('data-open', 'false')
  })
  test(`${type} reveals composition without preventing or moving its input range`, async ({ page }) => {
    const { body, block, popup, position } = await arrowSource(page, type)
    const prevented = await body.evaluate((element) => {
      const event = new CompositionEvent('compositionstart', { bubbles: true, cancelable: true, data: '' })
      element.dispatchEvent(event)
      return event.defaultPrevented
    })
    expect(prevented).toBe(false)
    await expect(popup).toHaveAttribute('data-open', 'true')
    expect(await selectionPosition(body)).toEqual(position)
    await page.keyboard.insertText('汉')
    await body.dispatchEvent('compositionend', { data: '汉' })
    await expect(block.locator('code[aria-label]')).toContainText('汉')
    await expect(body).toContainText('Keep this paragraph')
  })
}

test('noneditable source controls do not reveal a closed source or mutate it', async ({ page }) => {
  const { block, popup, source } = await arrowSource(page, 'math')
  await block.getByRole('button', { name: 'Done', exact: true }).click()
  const edit = block.getByRole('button', { name: 'Edit formula', exact: true })
  await edit.focus()
  await edit.press('q')
  await edit.dispatchEvent('compositionstart', { data: '' })
  await expect(popup).toHaveAttribute('data-open', 'false')
  await expect(block.locator('code[aria-label]')).toHaveText(source)
})

test('a publication lock prevents edits in an already visible source', async ({ page }) => {
  const { ack, body, block, popup, source } = await arrowSource(page, 'math')
  let release: () => void = () => {}
  const responseGate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`**/api/admin/documents/${ack.documentId}/publish`, async (route) => {
    await responseGate
    await route.continue()
  })
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  try {
    await expect(body).toHaveAttribute('contenteditable', 'false')
    await body.focus()
    await page.keyboard.press('q')
    await body.dispatchEvent('compositionstart', { data: '' })
    await block.getByRole('button', { name: 'Edit formula', exact: true }).dispatchEvent('click')
    await expect(popup).toHaveAttribute('data-open', 'true')
    await expect(block.locator('code[aria-label]')).toHaveText(source)
  }
  finally {
    release()
  }
  await expect(body).toHaveAttribute('contenteditable', 'true')
})

test('a late diagram preview preserves boundary ArrowUp and the following composition range', async ({ page }) => {
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/render/mermaid', async (route) => {
    await gate
    await route.continue()
  })
  try {
    const { body, block, popup, position } = await arrowSource(page, 'mermaid')
    release()
    await expect(page.frameLocator('iframe[title="Live diagram"]').locator('svg')).toBeVisible({ timeout: 15000 })
    await expect(popup).toHaveAttribute('data-open', 'true')
    expect(await selectionPosition(body)).toEqual(position)
    const prevented = await body.evaluate((element) => {
      const event = new CompositionEvent('compositionstart', { bubbles: true, cancelable: true, data: '' })
      element.dispatchEvent(event)
      return event.defaultPrevented
    })
    expect(prevented).toBe(false)
    expect(await selectionPosition(body)).toEqual(position)
    await page.keyboard.insertText('汉')
    await body.dispatchEvent('compositionend', { data: '汉' })
    await expect(block.locator('code[aria-label]')).toContainText('汉')
  }
  finally {
    release()
  }
})
