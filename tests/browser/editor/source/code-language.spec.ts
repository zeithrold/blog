import type { Locator, Page } from '@playwright/test'
import { openDocumentSchema } from '@/content/contracts'
import { emptyDocument } from '@/content/document'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { draftPreview } from '~/tests/support/browser/preview'
import { expect, test } from '~/tests/support/browser/test'

const code = 'const total = 1\nconsole.log(total)'

async function codeDocument(page: Page, language = 'text', source = code) {
  const document = emptyDocument()
  document.meta.title = 'Native code language'
  document.meta.slug = `code-language-${crypto.randomUUID()}`
  document.blocks.unshift({
    id: crypto.randomUUID(),
    type: 'codeBlock',
    props: { language },
    content: [
      { type: 'text', text: source, styles: {} },
    ],
    children: [],
  })
  return await writeDocument(page, document)
}

async function storedLanguage(page: Page, id: string, language: string, source = code): Promise<void> {
  const response = await page.request.get(`/api/admin/documents/${id}`)
  const document = openDocumentSchema.parse(await response.json()).document
  expect(document.blocks[0]).toMatchObject({
    type: 'codeBlock',
    props: { language },
    content: [
      { type: 'text', text: source, styles: {} },
    ],
  })
}

async function coloredTokens(codeElement: Locator): Promise<void> {
  await expect.poll(async () => new Set(await codeElement.locator('.shiki').evaluateAll(elements =>
    elements.map(element => getComputedStyle(element).color))).size).toBeGreaterThan(2)
}

async function chooseTheme(page: Page, theme: 'Light' | 'Dark'): Promise<void> {
  await page.getByRole('button', { name: 'Appearance', exact: true }).click()
  await page.getByRole('menuitemradio', { name: theme, exact: true }).click()
  const canvas = page.locator('.blog-editor.bn-root').filter({
    has: page.getByLabel('Document body', { exact: true }),
  })
  await expect(canvas).toHaveAttribute('data-color-scheme', theme.toLowerCase())
  await expect(page.getByRole('menu', { name: 'Appearance', exact: true })).toHaveCount(0)
}

async function startComposition(body: Locator): Promise<void> {
  const allowed = await body.evaluate((element) => {
    const event = new CompositionEvent('compositionstart', { bubbles: true, cancelable: true, data: '' })
    element.dispatchEvent(event)
    return !event.defaultPrevented
  })
  expect(allowed).toBe(true)
}

for (const width of [1440, 390]) {
  test(`code highlighting updates live without changing native input history or source at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const source = 'def greet(name):\n    return "hello" + name'
    const ack = await codeDocument(page, 'text', source)
    const body = page.getByLabel('Document body', { exact: true })
    const block = body.locator('[data-content-type="codeBlock"]')
    const codeElement = block.locator('pre code')
    const selector = block.getByRole('combobox', { name: 'Code language', exact: true })
    await expect(codeElement.locator('.shiki')).toHaveCount(0)
    const identity = await codeElement.elementHandle()
    await selector.selectOption('python')
    await coloredTokens(codeElement)
    await saved(page)
    await storedLanguage(page, ack.documentId, 'python', source)
    await chooseTheme(page, 'Light')
    const keyword = codeElement.locator('.shiki').filter({ hasText: /^def$/ })
    await expect(keyword).toHaveCount(1)
    const light = await keyword.evaluate(element => getComputedStyle(element).color)
    await chooseTheme(page, 'Dark')
    await expect.poll(async () => await keyword.evaluate(element => getComputedStyle(element).color)).not.toBe(light)
    expect(await identity.evaluate(element => element.isConnected)).toBe(true)
    await page.screenshot({ path: info.outputPath(`code-highlight-dark-${width}.png`) })
    await chooseTheme(page, 'Light')
    await expect(keyword).toHaveCSS('color', light)
    await codeElement.locator('.shiki').last().click()
    await page.keyboard.press('ControlOrMeta+ArrowRight')
    await page.keyboard.insertText(' # edited')
    await expect(codeElement).toHaveText(`${source} # edited`)
    await expect(codeElement.locator('.shiki').filter({ hasText: '# edited' })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(codeElement).toHaveText(source)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expect(codeElement).toHaveText(`${source} # edited`)
    await startComposition(body)
    await page.keyboard.insertText(' 中文')
    await body.dispatchEvent('compositionend', { data: '中文' })
    const edited = `${source} # edited 中文`
    await expect(codeElement).toHaveText(edited)
    await coloredTokens(codeElement)
    const selectedSource = await codeElement.evaluate(element =>
      element.contains(window.getSelection()?.anchorNode ?? null))
    expect(selectedSource).toBe(true)
    await saved(page)
    await storedLanguage(page, ack.documentId, 'python', edited)
    await page.screenshot({ path: info.outputPath(`code-highlight-live-${width}.png`) })
    await page.reload()
    await expect(selector).toHaveValue('python')
    await expect(codeElement).toHaveText(edited)
    await coloredTokens(codeElement)
    await storedLanguage(page, ack.documentId, 'python', edited)
    await selector.selectOption('text')
    await expect(codeElement.locator('.shiki')).toHaveCount(0)
    await expect(codeElement).toHaveText(edited)
    await saved(page)
    await storedLanguage(page, ack.documentId, 'text', edited)
  })
}

for (const width of [1440, 390]) {
  test(`code language persists through save reload and reader preview at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const ack = await codeDocument(page)
    const block = page.getByLabel('Document body', { exact: true }).locator('[data-content-type="codeBlock"]')
    const selector = block.getByRole('combobox', { name: 'Code language', exact: true })
    await expect(selector).toHaveClass(/code-language-select/)
    await expect(selector).toHaveValue('text')
    await selector.selectOption('python')
    await expect(selector).toHaveValue('python')
    await saved(page)
    await storedLanguage(page, ack.documentId, 'python')
    await page.reload()
    await expect(selector).toHaveValue('python')
    expect(await block.locator('pre code').textContent()).toBe(code)
    const bounds = await selector.boundingBox()
    expect(bounds?.height).toBeGreaterThanOrEqual(32)
    expect(bounds?.height).toBeLessThanOrEqual(44)
    expect(bounds?.width).toBeLessThanOrEqual(160)
    expect((bounds?.x ?? -1) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width)
    await page.screenshot({ path: info.outputPath(`code-language-${width}.png`) })
    const preview = await draftPreview(page)
    await expect(preview.getByText('Python', { exact: true })).toBeVisible()
    expect(await preview.locator('code[data-language="python"]').textContent()).toBe(code)
    const renderedCode = preview.locator('pre[data-language="python"]')
    await expect(renderedCode).toHaveCSS('margin-top', '0px')
    await expect(renderedCode).toHaveCSS('border-top-width', '0px')
    await expect(renderedCode).toHaveCSS('border-radius', '0px')
    await page.screenshot({ path: info.outputPath(`code-reader-${width}.png`) })
    await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
    await selector.selectOption('typescript')
    await saved(page)
    await storedLanguage(page, ack.documentId, 'typescript')
    await page.reload()
    await expect(selector).toHaveValue('typescript')
  })
}

test('an unknown saved code language remains intact until the author selects another language', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const ack = await codeDocument(page, 'legacy-lang')
  const selector = page.getByRole('combobox', { name: 'Code language', exact: true })
  await expect(selector).toHaveValue('legacy-lang')
  await expect(page.locator('[data-content-type="codeBlock"] .shiki')).toHaveCount(0)
  await storedLanguage(page, ack.documentId, 'legacy-lang')
  await selector.focus()
  await expect(selector.locator('option:checked')).toHaveText('legacy-lang')
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(selector).toHaveValue('legacy-lang')
  await storedLanguage(page, ack.documentId, 'legacy-lang')
  const preview = await draftPreview(page)
  await expect(preview.getByText('legacy-lang', { exact: true })).toBeVisible()
  expect(await preview.locator('code[data-language="legacy-lang"]').textContent()).toBe(code)
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
  await selector.selectOption('ruby')
  await saved(page)
  await storedLanguage(page, ack.documentId, 'ruby')
  expect(errors).toEqual([])
})

test.describe('touch code language control', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 900 } })
  test('remains compact and usable after a publication lock', async ({ page }, info) => {
    const ack = await codeDocument(page)
    const selector = page.getByRole('combobox', { name: 'Code language', exact: true })
    await selector.tap()
    await selector.press('Escape')
    await selector.selectOption('python')
    await saved(page)
    const box = await selector.boundingBox()
    expect(box?.width).toBeLessThanOrEqual(160)
    expect(box?.height).toBeGreaterThanOrEqual(44)
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/publish', async (route) => {
      await gate
      await route.continue()
    })
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    try {
      await expect(selector).toBeDisabled()
    }
    finally {
      release()
    }
    await expect(selector).toBeEnabled()
    await selector.selectOption('rust')
    await saved(page)
    await storedLanguage(page, ack.documentId, 'rust')
    await page.screenshot({ path: info.outputPath('code-language-touch.png') })
  })
})
