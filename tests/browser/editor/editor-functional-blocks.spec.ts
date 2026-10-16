import type { Locator, Page } from '@playwright/test'
import type { Document } from '@/content/document'
import { openDocumentSchema } from '@/content/contracts'
import { emptyDocument } from '@/content/document'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'

function inline(text: string): [{ type: 'text', text: string, styles: Record<string, never> }] {
  return [
    { type: 'text', text, styles: {} },
  ]
}
function functionalDocument(type: 'toc' | 'math' | 'mermaid' = 'toc', empty = false): Document {
  const document = emptyDocument()
  document.meta.title = 'Readable functional blocks'
  document.meta.slug = `functional-${crypto.randomUUID()}`
  const paragraph = document.blocks[0]
  if (paragraph === undefined) {
    throw new Error('Missing paragraph')
  }
  paragraph.content = empty ? [] : inline('Keep this paragraph')
  const id = crypto.randomUUID()
  const props: Record<string, string> = type === 'mermaid' ? { description: 'Live diagram' } : {}
  const source = type === 'math' ? 'x^2+y^2=z^2' : 'graph TD\nA-->B'
  const functional: Document['blocks'][number] = type === 'toc'
    ? { id, type, props: { title: 'Live contents' }, children: [] }
    : { id, type, props, content: inline(source), children: [] }
  document.blocks = [functional, paragraph]
  return document
}
function body(page: Page): Locator {
  return page.getByLabel('Document body', { exact: true })
}
async function caret(locator: Locator, end = false): Promise<void> {
  await locator.evaluate((element, atEnd) => {
    const root = element.closest('[contenteditable="true"]')
    if (!(root instanceof HTMLElement)) {
      throw new TypeError('Missing editable root')
    }
    root.focus()
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(!atEnd)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, end)
}
async function persisted(page: Page, id: string): Promise<Document> {
  const response = await page.request.get(`/api/admin/documents/${id}`)
  expect(response.ok()).toBe(true)
  return openDocumentSchema.parse(await response.json()).document
}

test('canvas contents updates with headings and matches the draft reader', async ({ page }, info) => {
  const document = functionalDocument()
  document.blocks.splice(1, 0, {
    id: crypto.randomUUID(),
    type: 'heading',
    props: { level: 2, textAlignment: 'left', textColor: 'default', backgroundColor: 'default' },
    content: inline('Original heading'),
    children: [],
  })
  await writeDocument(page, document)
  const contents = body(page).getByRole('navigation', { name: 'Live contents', exact: true })
  await expect(contents.getByRole('button', { name: 'Original heading', exact: true })).toBeVisible()
  await body(page).locator('[data-content-type="heading"] .bn-inline-content').fill('Updated heading')
  await expect(contents.getByRole('button', { name: 'Updated heading', exact: true })).toBeVisible()
  await expect(contents.getByRole('button', { name: 'Original heading', exact: true })).toHaveCount(0)
  await contents.getByRole('button', { name: 'Updated heading', exact: true }).click()
  await expect(body(page)).toBeFocused()
  await page.getByRole('button', { name: 'More document actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Preview', exact: true }).click()
  const reader = page.getByRole('region', { name: 'Draft reader preview', exact: true })
  await expect(reader.getByRole('link', { name: 'Updated heading', exact: true })).toBeVisible()
  await expect(reader.getByRole('heading', { name: 'Updated heading', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('live-toc-and-draft-preview.png') })
})

test('block and inline formulas edit live and preserve native JSON after reload', async ({ page }, info) => {
  const document = functionalDocument('math')
  const paragraph = document.blocks[1]
  if (paragraph === undefined) {
    throw new Error('Missing paragraph')
  }
  paragraph.content = [
    ...inline('An inline formula '),
    { type: 'inlineMath', props: { source: 'a^2' } },
  ]
  const ack = await writeDocument(page, document)
  const formula = body(page).locator('[data-content-type="math"]')
  await expect(body(page).locator('math')).toHaveCount(2)
  expect((await formula.boundingBox())?.height).toBeLessThanOrEqual(150)
  const editFormula = formula.getByRole('button', { name: 'Edit formula', exact: true })
  expect((await editFormula.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await expect(formula.locator('.bn-preview-with-source-popup'))
    .not
    .toHaveClass(/ProseMirror-selectednode/)
  await editFormula.click()
  const source = formula.locator('code[aria-label="Formula source"]')
  await expect(source).toBeVisible()
  await source.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText('x^3+y^3=z^3')
  await expect(formula.locator('math')).toContainText('3')
  await page.keyboard.press('ControlOrMeta+Enter')
  await expect(formula.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
  await expect(formula.locator('math')).toBeVisible()
  const inlineFormula = body(page).locator('[data-inline-content-type="inlineMath"]')
  await inlineFormula.getByRole('button', { name: 'Edit formula', exact: true }).click()
  const inlineSource = page.getByRole('dialog', { name: 'Edit formula', exact: true })
    .getByLabel('Formula source', { exact: true })
  await inlineSource.fill('b^3')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await saved(page)
  const snapshot = await persisted(page, ack.documentId)
  expect(snapshot.blocks[0]).toMatchObject({ type: 'math', content: inline('x^3+y^3=z^3') })
  expect(snapshot.blocks[1]?.content).toContainEqual({ type: 'inlineMath', props: { source: 'b^3' } })
  await page.reload()
  await expect(body(page).locator('math')).toHaveCount(2)
  await expect(body(page).getByRole('textbox', { name: 'Formula source', exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('formula-preview-default.png') })
})

for (const type of [
  'toc',
  'math',
  'mermaid',
] as const) {
  test(`${type} selection protects held Backspace and Undo restores its content`, async ({ page }) => {
    const document = functionalDocument(type)
    const ack = await writeDocument(page, document)
    const block = body(page).locator(`[data-content-type="${type}"]`)
    await caret(body(page).locator('[data-content-type="paragraph"] .bn-inline-content'))
    await page.keyboard.down('Backspace')
    await expect(block).toBeVisible()
    await expect(body(page).locator('.ProseMirror-selectednode').first()).toBeVisible()
    for (let repeat = 0; repeat < 3; repeat++) {
      await page.keyboard.down('Backspace')
    }
    await expect(block).toBeVisible()
    await expect(body(page)).toContainText('Keep this paragraph')
    await page.keyboard.up('Backspace')
    expect((await persisted(page, ack.documentId)).blocks).toEqual(document.blocks)
    await page.keyboard.press('Backspace')
    await expect(block).toHaveCount(0)
    await expect(body(page)).toContainText('Keep this paragraph')
    await page.keyboard.press('ControlOrMeta+z')
    await expect(block).toBeVisible()
    await expect.poll(async () => (await persisted(page, ack.documentId)).blocks, { timeout: 15000 })
      .toEqual(document.blocks)
    await page.reload()
    await expect(block).toBeVisible()
  })
}

test('first Backspace retains an empty paragraph and respects IME composition and normal text', async ({ page }) => {
  const ack = await writeDocument(page, functionalDocument('toc', true))
  const paragraph = body(page).locator('[data-content-type="paragraph"] .bn-inline-content')
  await caret(paragraph)
  await body(page).dispatchEvent('compositionstart', { data: '' })
  await body(page).dispatchEvent('keydown', { key: 'Backspace', code: 'Backspace', isComposing: true })
  await expect(body(page).locator('.ProseMirror-selectednode')).toHaveCount(0)
  await expect(body(page).locator('[data-content-type="toc"]')).toBeVisible()
  await body(page).dispatchEvent('compositionend', { data: '' })
  await caret(paragraph)
  await page.keyboard.press('Backspace')
  await expect(body(page).locator('.ProseMirror-selectednode').first()).toBeVisible()
  await expect(paragraph).toHaveCount(1)
  expect((await persisted(page, ack.documentId)).blocks).toHaveLength(2)
  await page.keyboard.press('ArrowRight')
  await caret(paragraph)
  await page.keyboard.type('Plain text')
  await caret(paragraph, true)
  await page.keyboard.press('Backspace')
  await expect(paragraph).toContainText('Plain tex')
  await expect(body(page).locator('[data-content-type="toc"]')).toBeVisible()
})

test('Backspace in a portaled block menu leaves its document untouched', async ({ page }) => {
  const document = functionalDocument()
  const ack = await writeDocument(page, document)
  const paragraph = body(page).locator('[data-content-type="paragraph"] .bn-inline-content')
  await caret(paragraph)
  await paragraph.hover()
  await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
  const menu = page.locator('.editor-desktop-block-actions')
  const colors = menu.getByRole('button', { name: 'Colors', exact: true })
  await colors.focus()
  await colors.press('Backspace')
  await expect(body(page).locator('.ProseMirror-selectednode')).toHaveCount(0)
  await expect(body(page).locator('[data-content-type="toc"]')).toBeVisible()
  await expect(paragraph).toContainText('Keep this paragraph')
  expect((await persisted(page, ack.documentId)).blocks).toEqual(document.blocks)
})

test('a nested source block is selected before native merging reaches its hidden source', async ({ page }) => {
  const document = functionalDocument('math')
  const math = document.blocks[0]
  const following = document.blocks[1]
  if (math === undefined || following === undefined) {
    throw new Error('Missing nested fixture')
  }
  const parent = structuredClone(following)
  parent.id = crypto.randomUUID()
  parent.content = inline('Parent paragraph')
  parent.children = [math]
  document.blocks = [parent, following]
  const ack = await writeDocument(page, document)
  const paragraph = body(page).locator(`[data-id="${following.id}"] .bn-inline-content`)
  await caret(paragraph)
  await page.keyboard.press('Backspace')
  await expect(body(page).locator('[data-content-type="math"]')).toBeVisible()
  await expect(body(page).locator('.ProseMirror-selectednode').first()).toBeVisible()
  await expect(paragraph).toContainText('Keep this paragraph')
  expect((await persisted(page, ack.documentId)).blocks).toEqual(document.blocks)
})

test('Backspace on a noneditable block control does not arm deletion', async ({ page }) => {
  const ack = await writeDocument(page, functionalDocument('toc'))
  const paragraph = body(page).locator('[data-content-type="paragraph"] .bn-inline-content')
  await caret(paragraph)
  const edit = body(page).getByRole('button', { name: 'Edit table of contents', exact: true })
  expect(await edit.evaluate(element => element instanceof HTMLElement && element.isContentEditable)).toBe(false)
  await edit.focus()
  await edit.press('Backspace')
  await expect(body(page).locator('.ProseMirror-selectednode')).toHaveCount(0)
  await expect(body(page).locator('[data-content-type="toc"]')).toBeVisible()
  await expect(paragraph).toContainText('Keep this paragraph')
  expect((await persisted(page, ack.documentId)).blocks).toHaveLength(2)
})
