import type { Page } from '@playwright/test'
import type { SourceKind } from './source-input-helpers'
import { writeDocument } from '~/tests/support/browser/document'
import { expect, test } from '~/tests/support/browser/test'
import {
  openSourceFixture,
  persistedSource,
  selectSourceBlock,
  sourceDocument,
  sourceText,
} from './source-input-helpers'

const errors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', error => messages.push(error.message))
})
test.afterEach(({ page }) => {
  expect(errors.get(page) ?? []).toEqual([])
})

async function expectSavedSource(page: Page, id: string, kind: SourceKind, value: string): Promise<void> {
  await expect.poll(async () => (await persistedSource(page, id)).blocks.find(block => block.type === kind)?.content, {
    timeout: 15000,
  }).toEqual([
    { type: 'text', text: value, styles: {} },
  ])
  await expect(page.getByLabel('Document body', { exact: true }).locator('[data-content-type="paragraph"]'))
    .toHaveText('Keep this paragraph')
}

for (const kind of ['math', 'mermaid'] as const) {
  const edit = kind === 'math' ? 'Edit formula' : 'Edit diagram'
  test(`${kind} Enter enters source text before the next Enter inserts a line`, async ({ page }) => {
    const { body, block, initial } = await openSourceFixture(page, kind)
    await selectSourceBlock(page, body)
    await page.keyboard.press('Enter')
    await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'true')
    expect(await block.locator('code[role="textbox"]').evaluate(element =>
      element.contains(window.getSelection()?.anchorNode ?? null)))
      .toBe(true)
    await page.keyboard.press('Enter')
    await page.keyboard.type('q')
    await expect(block.locator('code[role="textbox"]')).toHaveText(`${sourceText[kind]}\nq`)
    await expectSavedSource(page, initial.documentId, kind, `${sourceText[kind]}\nq`)
    await page.keyboard.press('ControlOrMeta+z')
    await expect(block).toBeVisible()
    await expect(body).toContainText('Keep this paragraph')
  })
  for (const selected of [true, false]) {
    test(`${kind} rich clipboard becomes source text with node selection ${String(selected)}`, async ({ page }) => {
      const { body, block, initial } = await openSourceFixture(page, kind)
      if (selected) {
        await selectSourceBlock(page, body)
      }
      else {
        await block.getByRole('button', { name: edit, exact: true }).click()
      }
      const inserted = kind === 'math' ? '\ny=2\nz=3' : '\nB-->C\nC-->D'
      await body.evaluate((element, text) => {
        const clipboardData = new DataTransfer()
        clipboardData.setData('text/plain', text)
        clipboardData.setData('text/html', '<p>HTML must not create a block</p><p>Another block</p>')
        element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }))
      }, inserted)
      await expect(block.locator('code[role="textbox"]')).toHaveText(sourceText[kind] + inserted)
      await expectSavedSource(page, initial.documentId, kind, sourceText[kind] + inserted)
      expect((await persistedSource(page, initial.documentId)).blocks).toHaveLength(2)
      await page.reload()
      await expect(block.locator('code[role="textbox"]')).toHaveText(sourceText[kind] + inserted)
    })
  }
  test(`${kind} text insertion without keydown keeps its selected node`, async ({ page }) => {
    const { body, block, initial } = await openSourceFixture(page, kind)
    await selectSourceBlock(page, body)
    await page.keyboard.insertText('汉')
    await expect(block.locator('code[role="textbox"]')).toHaveText(`${sourceText[kind]}汉`)
    await expectSavedSource(page, initial.documentId, kind, `${sourceText[kind]}汉`)
  })
  test(`${kind} composition starts inside source and keeps its range`, async ({ page }) => {
    const { body, block, initial } = await openSourceFixture(page, kind)
    await selectSourceBlock(page, body)
    const prevented = await body.evaluate((element) => {
      const event = new CompositionEvent('compositionstart', { bubbles: true, cancelable: true })
      element.dispatchEvent(event)
      return event.defaultPrevented
    })
    expect(prevented).toBe(false)
    expect(await block.locator('code[role="textbox"]').evaluate(element =>
      element.contains(window.getSelection()?.anchorNode ?? null)))
      .toBe(true)
    await body.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
    await page.keyboard.insertText('汉')
    await body.dispatchEvent('compositionend', { data: '汉' })
    await expectSavedSource(page, initial.documentId, kind, `${sourceText[kind]}汉`)
  })
  test(`${kind} beforeinput deletion and line breaks respect source boundaries`, async ({ page }) => {
    const { body, block } = await openSourceFixture(page, kind)
    await block.getByRole('button', { name: edit, exact: true }).click()
    const send = async (inputType: string): Promise<boolean> => await body.evaluate((element, operation) => {
      const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: operation })
      element.dispatchEvent(event)
      return event.defaultPrevented
    }, inputType)
    expect(await send('deleteContentForward')).toBe(true)
    await expect(block.locator('code[role="textbox"]')).toHaveText(sourceText[kind])
    expect(await send('insertParagraph')).toBe(true)
    await expect(block.locator('code[role="textbox"]')).toHaveText(`${sourceText[kind]}\n`)
    await expect(body).toContainText('Keep this paragraph')
  })
}

test('reverse cross-block selection keeps Mod+A at document scope', async ({ page }) => {
  const initialDocument = sourceDocument('math')
  const sourceBlock = initialDocument.blocks[0]
  const before = initialDocument.blocks[1]
  if (sourceBlock === undefined || before === undefined) {
    throw new Error('Missing cross-block fixture')
  }
  const after = { ...before, id: crypto.randomUUID(), content: [
    { type: 'text' as const, text: 'After source', styles: {} },
  ] }
  initialDocument.blocks = [
    before,
    sourceBlock,
    after,
  ]
  const initial = await writeDocument(page, initialDocument)
  const body = page.getByLabel('Document body', { exact: true })
  await body.getByRole('button', { name: 'Edit formula', exact: true }).click()
  await body.evaluate((element) => {
    const source = element.querySelector('[data-content-type="math"] code')
    const paragraph = element.querySelector('[data-content-type="paragraph"] .bn-inline-content')
    if (source === null || paragraph === null) {
      throw new Error('Missing cross-block selection')
    }
    const anchor = document.createTreeWalker(source, NodeFilter.SHOW_TEXT).nextNode()
    const focus = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT).nextNode()
    if (anchor === null || focus === null) {
      throw new Error('Missing cross-block text')
    }
    window.getSelection()?.setBaseAndExtent(anchor, 3, focus, 2)
    document.dispatchEvent(new Event('selectionchange'))
  })
  await expect.poll(async () => await page.evaluate(() => window.getSelection()?.toString()))
    .toContain('this paragraph')
  await page.keyboard.press('ControlOrMeta+a')
  const selected = await page.evaluate(() => window.getSelection()?.toString())
  expect(selected).toContain('Keep this paragraph')
  expect(selected).toContain('After source')
  expect((await persistedSource(page, initial.documentId)).blocks).toHaveLength(3)
})

for (const locked of [false, true]) {
  test(`a lone source closes without hidden editing while publication locked ${String(locked)}`, async ({ page }) => {
    const initialDocument = sourceDocument('math')
    initialDocument.blocks.splice(1)
    const initial = await writeDocument(page, initialDocument)
    const body = page.getByLabel('Document body', { exact: true })
    const block = body.locator('[data-content-type="math"]')
    await block.getByRole('button', { name: 'Edit formula', exact: true }).click()
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    if (locked) {
      await page.route(`**/api/admin/documents/${initial.documentId}/publish`, async (route) => {
        await gate
        await route.continue()
      })
      await page.getByRole('button', { name: 'Publish', exact: true }).click()
      await expect(body).toHaveAttribute('contenteditable', 'false')
    }
    try {
      await block.getByRole('button', { name: 'Done', exact: true }).click()
      await expect(block.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
      if (locked) {
        expect((await persistedSource(page, initial.documentId)).blocks).toHaveLength(1)
      }
      else {
        await expect(body).toBeFocused()
        await page.keyboard.type('After source')
        await expect(body.locator('[data-content-type="paragraph"]')).toHaveText('After source')
      }
      await expect(block.locator('code[role="textbox"]')).toHaveText(sourceText.math)
    }
    finally {
      release()
    }
    if (locked) {
      await expect(body).toHaveAttribute('contenteditable', 'true')
    }
  })
}
