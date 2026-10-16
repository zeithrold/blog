import type { Locator, Page } from '@playwright/test'
import { openDocumentSchema } from '@/content/contracts'
import { emptyDocument } from '@/content/document'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { draftPreview } from '~/tests/support/browser/preview'
import { expect, test } from '~/tests/support/browser/test'

async function separateRows(formula: Locator): Promise<void> {
  const rows = formula.locator('math mtr')
  await expect(rows).toHaveCount(2)
  const first = await rows.nth(0).boundingBox()
  const second = await rows.nth(1).boundingBox()
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  expect(second?.y ?? 0).toBeGreaterThan((first?.y ?? 0) + (first?.height ?? 0))
}

async function formulaDocument(page: Page) {
  const document = emptyDocument()
  document.meta.title = 'Formula editing focus'
  document.meta.slug = `formula-focus-${crypto.randomUUID()}`
  return await writeDocument(page, document)
}

for (const width of [1440, 390]) {
  test(`new block formulas receive typing immediately at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const ack = await formulaDocument(page)
    const body = page.getByLabel('Document body', { exact: true })
    await body.pressSequentially('/math')
    const palette = page.getByRole('listbox', { name: 'Insert block', exact: true })
    await expect(palette.getByRole('option', { selected: true }).locator('.editor-option-title'))
      .toHaveText('Formula')
    await body.press('Enter')
    const formula = body.locator('[data-content-type="math"]')
    const source = formula.getByRole('textbox', { name: 'Formula source', exact: true })
    await expect(source).toBeVisible()
    await expect(body).toBeFocused()
    expect(await source.evaluate(element => element.contains(window.getSelection()?.anchorNode ?? null))).toBe(true)
    await page.keyboard.type('x^2+y^2=z^2')
    await expect(source).toHaveText('x^2+y^2=z^2')
    await expect(formula.locator('math')).toContainText('2')
    await expect(formula.locator('.bn-source-block-popup')).toHaveCSS('position', 'static')
    expect(await source.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return box.left >= 0 && box.right <= window.innerWidth
    })).toBe(true)
    const done = formula.getByRole('button', { name: 'Done', exact: true })
    await expect(done).toHaveAttribute('data-slot', 'button')
    await page.screenshot({ path: info.outputPath(`formula-source-${width}.png`) })
    await done.click()
    await expect(done).toHaveCount(0)
    await expect(source).toHaveCount(0)
    await saved(page)
    const response = await page.request.get(`/api/admin/documents/${ack.documentId}`)
    const snapshot = openDocumentSchema.parse(await response.json()).document
    expect(snapshot.blocks.find(block => block.type === 'math')?.content)
      .toEqual([
        { type: 'text', text: 'x^2+y^2=z^2', styles: {} },
      ])
    await page.reload()
    await expect(formula.locator('.bn-preview-with-source-popup')).toHaveAttribute('data-open', 'false')
    await expect(formula.locator('math')).toBeVisible()
  })
}

for (const width of [1440, 390]) {
  test(`display formula rows and multiline source roundtrip at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const ack = await formulaDocument(page)
    const body = page.getByLabel('Document body', { exact: true })
    await body.pressSequentially('/math')
    const palette = page.getByRole('listbox', { name: 'Insert block', exact: true })
    await expect(palette.getByRole('option', { selected: true }).locator('.editor-option-title'))
      .toHaveText('Formula')
    await body.press('Enter')
    const formula = body.locator('[data-content-type="math"]')
    const source = formula.getByRole('textbox', { name: 'Formula source', exact: true })
    await expect(source).toBeVisible()
    const blocks = body.locator('.bn-block')
    const count = await blocks.count()
    await page.keyboard.type('x = 123')
    await page.keyboard.press('Enter')
    await page.keyboard.type(String.raw`\\`)
    await page.keyboard.press('Shift+Enter')
    await page.keyboard.type('y = 456')
    const authored = `x = 123\n${String.raw`\\`}\ny = 456`
    await expect.poll(async () => await source.textContent()).toBe(authored)
    await expect(blocks).toHaveCount(count)
    await separateRows(formula)
    await page.screenshot({ path: info.outputPath(`formula-multiline-${width}.png`) })
    await formula.getByRole('button', { name: 'Done', exact: true }).click()
    await saved(page)
    const snapshot = openDocumentSchema.parse(await (await page.request.get(
      `/api/admin/documents/${ack.documentId}`,
    )).json()).document
    expect(snapshot.blocks.find(block => block.type === 'math')?.content)
      .toEqual([
        { type: 'text', text: authored, styles: {} },
      ])
    await page.reload()
    await separateRows(formula)
    await formula.getByRole('button', { name: 'Edit formula', exact: true }).click()
    await expect.poll(async () => await source.textContent()).toBe(authored)
    await formula.getByRole('button', { name: 'Done', exact: true }).click()
    const reader = await draftPreview(page)
    await separateRows(reader)
    await page.screenshot({ path: info.outputPath(`formula-reader-multiline-${width}.png`) })
  })
}

for (const width of [1440, 390]) {
  test(`new inline formulas focus their source editor at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await formulaDocument(page)
    const body = page.getByLabel('Document body', { exact: true })
    await body.pressSequentially('An inline formula ')
    await page.getByRole('button', { name: 'Inline formula', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit formula', exact: true })
    const source = dialog.getByLabel('Formula source', { exact: true })
    await expect(source).toBeFocused()
    await page.keyboard.type('a^2')
    await expect(source).toHaveValue('a^2')
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(body.locator('[data-inline-content-type="inlineMath"] math')).toContainText('2')
    await saved(page)
  })
}
