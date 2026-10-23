import type { Locator, Page, TestInfo } from '@playwright/test'
import type { Document } from '@/content/document'
import { openDocumentSchema } from '@/contracts/documents'
import { saved, writeDocument } from '~/tests/support/browser/document'
import { horizontalBounds, withinViewport } from '~/tests/support/browser/layout'
import { expect, test } from '~/tests/support/browser/test'
import { richDocument } from './rich-fixture'

async function screenshot(page: Page, info: TestInfo, name: string): Promise<void> {
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path })
  await info.attach(name, { path, contentType: 'image/png' })
}

function uiDocument(): Document {
  const document = richDocument()
  // Citation numbers follow first use, independently of bibliography ordering.
  document.references.reverse()
  document.blocks.splice(1, 0, {
    id: crypto.randomUUID(),
    type: 'checkListItem',
    props: { checked: false, textAlignment: 'left', textColor: 'default', backgroundColor: 'default' },
    children: [],
    content: [
      { type: 'text', text: 'Finish this task', styles: {} },
    ],
  })
  return document
}

async function compactMarkers(page: Page): Promise<void> {
  const body = page.getByLabel('Document body', { exact: true })
  await expect(body.locator('.inline-reference').locator('input, [role="combobox"]')).toHaveCount(0)
  const citation = body.getByRole('button', { name: 'Citation reference', exact: true })
  const note = body.getByRole('button', { name: 'Footnote reference', exact: true })
  await expect(citation).toHaveText('[1, p. 3]')
  await expect(note).toHaveText('1')
  for (const marker of [citation, note]) {
    const bounds = await marker.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds?.height).toBeLessThanOrEqual(30)
    expect(bounds?.width).toBeLessThan(100)
    await horizontalBounds(page, marker)
  }
}

async function popup(page: Page, name: string): Promise<Locator> {
  const body = page.getByLabel('Document body', { exact: true })
  await body.getByRole('button', { name, exact: true }).locator('span').click()
  const panel = page.getByRole('dialog', { name, exact: true })
  await expect(panel).toBeVisible()
  await withinViewport(page, panel)
  return panel
}

async function toggleTask(page: Page, documentId: string): Promise<void> {
  const task = page.getByRole('checkbox', { name: 'Checklist', exact: true })
  await expect(task).toHaveClass(/ztd-checkbox/)
  await expect(task).toHaveCSS('width', '24px')
  await task.focus()
  await page.keyboard.press('Space')
  await expect(task).toBeChecked()
  await saved(page)
  const actions = page.getByRole('toolbar', { name: 'Editor actions', exact: true })
  await actions.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(task).not.toBeChecked()
  await actions.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(task).toBeChecked()
  await saved(page)
  await expect.poll(async () => {
    const response = await page.request.get(`/api/admin/documents/${documentId}`)
    const document = openDocumentSchema.parse(await response.json()).document
    return document.blocks.find(block => block.type === 'checkListItem')?.props.checked
  }).toBe(true)
}

async function rendered(page: Page, description = 'Safe diagram'): Promise<Locator> {
  const figure = page.locator('.diagram').filter({ hasText: description })
  await figure.scrollIntoViewIfNeeded()
  const frame = figure.locator('iframe')
  await expect(page.frameLocator(`iframe[title="${description}"]`).locator('svg')).toBeVisible({ timeout: 15000 })
  await expect(figure).toHaveAttribute('aria-busy', 'false')
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts')
  await expect(figure.locator('button, pre')).toHaveCount(0)
  await expect(figure).toHaveCSS('border-top-width', '0px')
  await horizontalBounds(page, frame)
  const mode = await page.locator('.ztd-frontend').first().evaluate(element => getComputedStyle(element).colorScheme)
  await expect(page.frameLocator(`iframe[title="${description}"]`).locator('html')).toHaveCSS('color-scheme', mode)
  const frameBounds = await frame.boundingBox()
  const figureBounds = await figure.boundingBox()
  if (frameBounds === null || figureBounds === null) {
    throw new Error('Diagram and frame must have layout bounds')
  }
  expect(frameBounds.width).toBeCloseTo(figureBounds.width, 0)
  // The drawing is centered inside the full-width, opaque sandbox.
  const drawing = page.frameLocator(`iframe[title="${description}"]`).locator('svg')
  const bounds = await drawing.boundingBox()
  if (bounds === null) {
    throw new Error('Rendered diagram must have layout bounds')
  }
  expect(Math.abs(bounds.x + bounds.width / 2 - (frameBounds.x + frameBounds.width / 2))).toBeLessThanOrEqual(2)
  return figure
}

for (const width of [
  1440,
  390,
  320,
]) {
  test(`compact references, checklist and diagrams survive editing at ${width}px`, async ({ page }, info) => {
    test.setTimeout(120000)
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const document = uiDocument()
    const ack = await writeDocument(page, document)
    if (width === 390) {
      await page.getByRole('button', { name: 'Appearance', exact: true }).click()
      await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
    }
    await compactMarkers(page)
    await screenshot(page, info, 'compact-references')
    await test.step('edit citation in a bounded panel, then restore focus to its marker', async () => {
      const panel = await popup(page, 'Citation reference')
      const locator = panel.getByRole('textbox', { name: 'Citation locator', exact: true })
      await locator.fill('9'.repeat(100))
      const compact = page.locator('[data-inline-content-type="citation"] .inline-reference-marker')
      expect((await compact.boundingBox())?.width).toBeLessThanOrEqual(154)
      await horizontalBounds(page, compact)
      await locator.fill('p. 9')
      await panel.getByRole('button', { name: 'Done', exact: true }).click()
      const marker = page.getByRole('button', { name: 'Citation reference', exact: true })
      await expect(marker).toHaveText('[1, p. 9]')
      await expect(marker).toBeFocused()
    })
    await test.step('footnote settings close cleanly and retain the selected definition', async () => {
      const panel = await popup(page, 'Footnote reference')
      await expect(panel.getByRole('combobox', { name: 'Footnote reference', exact: true }))
        .toHaveText('A native footnote')
      await panel.getByRole('button', { name: 'Done', exact: true }).click()
      const marker = page.getByLabel('Document body', { exact: true })
        .getByRole('button', { name: 'Footnote reference', exact: true })
      await expect(marker).toBeFocused()
    })
    await toggleTask(page, ack.documentId)
    const body = page.getByLabel('Document body', { exact: true })
    await body.locator('[data-content-type="paragraph"]').first().scrollIntoViewIfNeeded()
    await screenshot(page, info, 'shared-checklist')
    const figure = await rendered(page)
    await expect(figure.locator('..')).toHaveClass(/bn-preview-container/)
    await expect(page.locator('.source-compact')).toHaveCount(1)
    await screenshot(page, info, 'diagram-editor')
    await saved(page)
    await page.reload()
    await expect(page.getByRole('checkbox', { name: 'Checklist', exact: true })).toBeChecked()
    await expect(page.getByRole('button', { name: 'Citation reference', exact: true })).toHaveText('[1, p. 9]')
    const response = await page.request.get(`/api/admin/documents/${ack.documentId}`)
    const persisted = openDocumentSchema.parse(await response.json())
    expect(persisted.document.blocks.map(block => block.id)).toEqual(document.blocks.map(block => block.id))
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Update publication', exact: true })).toBeVisible()
    await page.goto(`/posts/${document.meta.slug}`)
    await expect(page.getByRole('link', { name: 'Reference 1', exact: true })).toHaveText('[1, p. 9]')
    await rendered(page)
    await screenshot(page, info, 'automatic-reader-diagram')
    expect(errors).toEqual([])
  })
}

test('automatic diagrams retry failures and render more than two without manual switches', async ({ page }, info) => {
  const document = uiDocument()
  const diagram = document.blocks.find(block => block.type === 'mermaid')
  if (diagram === undefined) {
    throw new Error('Missing diagram')
  }
  document.blocks = [
    diagram,
    ...[2, 3].map(number => ({
      ...structuredClone(diagram),
      id: crypto.randomUUID(),
      props: { description: `Diagram ${number}` },
    })),
  ]
  let failures = 0
  await page.route('**/render/mermaid', async (route) => {
    failures++
    await route.fulfill({ status: 503, body: 'Injected renderer failure' })
  })
  await writeDocument(page, document)
  const first = page.locator('.diagram').first()
  await first.scrollIntoViewIfNeeded()
  await expect(first.getByRole('button', { name: 'Retry diagram', exact: true })).toBeVisible()
  await expect(first).toContainText('Diagram could not be loaded.')
  expect(failures).toBeGreaterThan(0)
  await page.unroute('**/render/mermaid')
  for (const description of [
    'Safe diagram',
    'Diagram 2',
    'Diagram 3',
  ]) {
    const figure = page.locator('.diagram').filter({ hasText: description })
    await figure.scrollIntoViewIfNeeded()
    const retry = figure.getByRole('button', { name: 'Retry diagram', exact: true })
    if (await retry.isVisible()) {
      await retry.click()
    }
    await rendered(page, description)
  }
  await expect(page.locator('.diagram iframe')).toHaveCount(3)
  await screenshot(page, info, 'diagram-recovery')
})

test('shared checklist keeps native Enter and locks with inline markers during publication', async ({ page }) => {
  const document = uiDocument()
  const ack = await writeDocument(page, document)
  const body = page.getByLabel('Document body', { exact: true })
  await body.getByText('Finish this task', { exact: true }).click()
  await expect.poll(async () => await body.evaluate((element) => {
    const anchor = window.getSelection()?.anchorNode
    const task = anchor?.parentElement?.closest('[data-content-type="checkListItem"]')
    return task !== null && task !== undefined && element.contains(task)
  }), { message: 'Enter must start with the text caret inside the checklist item' }).toBe(true)
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Another task')
  const tasks = body.getByRole('checkbox', { name: 'Checklist', exact: true })
  await expect(tasks).toHaveCount(2)
  await expect(body.locator('[data-content-type="checkListItem"]')).toContainText(['Finish this task', 'Another task'])
  await saved(page)
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`**/api/admin/documents/${ack.documentId}/publish`, async (route) => {
    await gate
    await route.continue()
  })
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  try {
    await expect(body).toHaveAttribute('contenteditable', 'false')
    await expect(tasks.first()).toBeDisabled()
    await expect(tasks.last()).toBeDisabled()
    await expect(body.getByRole('button', { name: 'Citation reference', exact: true })).toBeDisabled()
    await expect(body.getByRole('button', { name: 'Footnote reference', exact: true })).toBeDisabled()
  }
  finally {
    release()
  }
  await expect(page.getByRole('button', { name: 'Update publication', exact: true })).toBeVisible()
  await expect(tasks.first()).toBeEnabled()
  await expect(tasks.last()).not.toBeChecked()
})
