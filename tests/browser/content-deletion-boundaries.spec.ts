import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { openDocumentSchema } from '../../src/content/contracts'
import { emptyDocument } from '../../src/content/document'
import { saved, settingsTab, writeDocument } from './helpers'
import { tableDocument } from './table-overlay-helpers'

async function removeBlock(page: Page, block: Locator): Promise<void> {
  await block.scrollIntoViewIfNeeded()
  await block.hover()
  await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
  await page.locator('.editor-block-action-list').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.locator('.editor-block-action-list')).toHaveCount(0)
}
async function closeSettings(page: Page): Promise<void> {
  const drawer = page.getByRole('dialog', { name: 'Document settings', exact: true })
  if (await drawer.isVisible()) {
    await drawer.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(drawer).toHaveCount(0)
  }
}
function noteDocument(): ReturnType<typeof emptyDocument> {
  const document = emptyDocument()
  document.meta.title = 'Repair deleted footnotes'
  document.meta.slug = `deleted-footnote-${crypto.randomUUID()}`
  const noteId = crypto.randomUUID()
  const first = document.blocks[0]
  if (first === undefined) {
    throw new Error('Missing paragraph')
  }
  first.content = [
    { type: 'text', text: 'This passage has a note ', styles: {} },
    { type: 'footnoteRef', props: { noteId } },
  ]
  document.blocks.push({
    id: noteId,
    type: 'footnote',
    props: {},
    children: [],
    content: [
      { type: 'text', text: 'Original note', styles: {} },
    ],
  }, {
    id: crypto.randomUUID(),
    type: 'footnote',
    props: {},
    children: [],
    content: [
      { type: 'text', text: 'Replacement note', styles: {} },
    ],
  })
  return document
}

for (const width of [1440, 390]) {
  test(`deleted footnotes save, undo, reload and repair at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const document = noteDocument()
    const ack = await writeDocument(page, document)
    const body = page.getByLabel('Document body', { exact: true })
    const original = body.locator('[data-content-type="footnote"]').filter({ hasText: 'Original note' })
    const picker = page.getByRole('combobox', { name: 'Footnote reference', exact: true })
    await removeBlock(page, original)
    await expect(picker).toContainText('Footnote unavailable — choose another')
    await expect(picker).toHaveAttribute('aria-invalid', 'true')
    await saved(page)
    const localCopy = page.getByRole('status').filter({ hasText: /^Local copy saved / })
    await expect(localCopy).toHaveAttribute('data-state', 'saved')
    const response = await page.request.get(`/api/admin/documents/${ack.documentId}`)
    const current = openDocumentSchema.parse(await response.json())
    expect(current.document.blocks).toHaveLength(2)
    await page.getByRole('toolbar', { name: 'Editor actions', exact: true })
      .getByRole('button', { name: 'Undo', exact: true })
      .click()
    await expect(original).toBeVisible()
    await expect(picker).toContainText('Original note')
    await removeBlock(page, original)
    await saved(page)
    await page.reload()
    await expect(picker).toHaveAttribute('aria-invalid', 'true')
    await settingsTab(page, 'Publication')
    const issue = 'Choose an existing footnote for each footnote reference.'
    await expect(page.locator('.publication-issues')).toContainText(issue)
    await closeSettings(page)
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.locator('.editor-notice[data-tone="error"]')).toContainText(issue)
    await page.screenshot({ path: info.outputPath(`deleted-footnote-${width}.png`) })
    await picker.click()
    await page.getByRole('option', { name: 'Replacement note', exact: true }).click()
    await expect(picker).not.toHaveAttribute('aria-invalid', 'true')
    await saved(page)
    await settingsTab(page, 'Publication')
    await expect(page.locator('.publication-issues')).toHaveCount(0)
    await closeSettings(page)
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Update publication', exact: true })).toBeVisible()
    const publicPage = await page.request.get(`/posts/${document.meta.slug}`)
    expect(publicPage.ok()).toBe(true)
    expect(await publicPage.text()).toContain('Replacement note')
  })
}

for (const type of ['table', 'image'] as const) {
  test(`rich paste after deleting an annotated ${type} preserves undo metadata`, async ({ page }) => {
    const document = tableDocument()
    const block = document.blocks[0]
    if (block === undefined) {
      throw new Error('Missing block')
    }
    if (type === 'table') {
      document.tableAccessibility[block.id] = { caption: 'Preserved caption' }
    }
    else {
      document.blocks[0] = {
        id: block.id,
        type: 'image',
        props: {
          url: '',
          name: '',
          caption: '',
          backgroundColor: 'default',
          textAlignment: 'left',
          showPreview: true,
        },
        children: [],
      }
      document.mediaAccessibility[block.id] = {
        alt: 'Preserved alternative text',
        decorative: false,
        transcript: '',
        captionAssetId: null,
        posterAssetId: null,
      }
    }
    const ack = await writeDocument(page, document)
    const body = page.getByLabel('Document body', { exact: true })
    const target = body.locator(`[data-content-type="${type}"]`).first()
    await removeBlock(page, target)
    const paragraph = body.locator('[data-content-type="paragraph"] .bn-inline-content').last()
    await paragraph.click()
    await body.evaluate((element) => {
      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', '<p><strong>Pasted rich content</strong></p>')
      clipboardData.setData('text/plain', 'Pasted rich content')
      element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }))
    })
    await expect(body.locator('strong')).toContainText('Pasted rich content')
    await saved(page)
    const undo = page.getByRole('toolbar', { name: 'Editor actions', exact: true })
      .getByRole('button', { name: 'Undo', exact: true })
    await undo.click()
    if (!(await target.isVisible())) {
      await undo.click()
    }
    await expect(target).toBeVisible()
    await saved(page)
    const response = await page.request.get(`/api/admin/documents/${ack.documentId}`)
    const current = openDocumentSchema.parse(await response.json())
    expect(current.document.tableAccessibility).toEqual(document.tableAccessibility)
    expect(current.document.mediaAccessibility).toEqual(document.mediaAccessibility)
  })
}
