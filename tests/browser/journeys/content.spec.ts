import type { TestInfo } from '@playwright/test'
import type { JourneyContext } from '~/tests/support/browser/journey'
import { assetDescriptorSchema } from '@/contracts/media'
import { tableWidgets } from '~/tests/browser/editor/tables/table-keyboard-helpers'
import { uploadFile } from '~/tests/browser/media/editor-media-flow-helpers'
import { addAuthor, editAuthor } from '~/tests/browser/references/reference-author-helpers'
import { saved, writeDocument } from '~/tests/support/browser/document'
import {
  documentAction,
  expect,
  layoutCheckpoint,
  navigation,
  opened,
  previewCheckpoint,
  semanticCheckpoint,
  test,
} from '~/tests/support/browser/journey'
import { expectReleased } from '~/tests/support/browser/journey-layout'
import { settingsTab } from '~/tests/support/browser/settings'
import { inline, mixedDocument, png } from './content-fixture'
import { dragWithMediaEvidence } from './drag-media-evidence'
import { expectMixedEditor, expectMixedReader } from './mixed-content-checks'

const title = 'long task: every native element survives mixed editing, media replacement, history and reading'

test(title, async ({ page, context, journey }, info) => {
  test.setTimeout(180000)
  const state = await prepare({ page, context, journey }, info)
  await test.step('review every rendered native element before editing', async () => await reviewMixedDocument(state))
  await test.step(
    'edit heading, undo and redo while retaining all mixed content',
    async () => await editMixedContent(state),
  )
  await test.step(
    'reorder blocks, change nesting and edit a table without losing adjacent elements',
    async () => await reorderAndEditTable(state),
  )
  await test.step(
    'replace the same image twice and retain its accessibility and identity',
    async () => await replaceImage(state),
  )
  await test.step(
    'edit referenced metadata and authors, then reopen previews late in the task',
    async () => await editReferenceAndReopen(state),
  )
  await test.step(
    'publish the final mixed document and verify the reader after navigation',
    async () => await publishMixedContent(state),
  )
})

async function prepare({ page, context, journey }: JourneyContext, info: TestInfo) {
  const expected = await mixedDocument(page)
  const ack = await writeDocument(page, expected)
  const editor = page.getByLabel('Document body', { exact: true })
  const identity = await editor.elementHandle()
  const heading = expected.blocks.find(block => block.type === 'heading')
  const bullet = expected.blocks.find(block => block.type === 'bulletListItem')
  const numbered = expected.blocks.find(block => block.type === 'numberedListItem')
  const table = expected.blocks.find(block => block.type === 'table')
  const image = expected.blocks.find(block => block.type === 'image')
  if (heading === undefined || bullet === undefined || numbered === undefined
    || table === undefined || image === undefined) {
    throw new Error('Incomplete mixed document')
  }

  return { page, context, journey, info, expected, ack, editor, identity, heading, bullet, numbered, table, image }
}

type State = Awaited<ReturnType<typeof prepare>>

async function editMixedContent(state: State): Promise<void> {
  const { page, journey, info, expected, ack, editor, heading } = state

  await semanticCheckpoint(page, info, journey, { name: 'mixed-initial', id: ack.documentId, expected })
  const input = editor.locator('[data-content-type="heading"] .bn-inline-content')
  await input.fill('Journey revised heading')
  await saved(page)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(input).toHaveText('Journey heading')
  await saved(page)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(input).toHaveText('Journey revised heading')
  heading.content = inline('Journey revised heading')
  await semanticCheckpoint(page, info, journey, { name: 'mixed-redone', id: ack.documentId, expected })
  await editor.getByText('Journey callout', { exact: true }).click()
  const tone = page.getByRole('combobox', { name: 'Callout tone', exact: true })
  await tone.evaluate(async (element) => {
    element.scrollIntoView({ block: 'center' })
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })
  })
  await tone.focus()
  await tone.press('ArrowDown')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.getByRole('option', { name: 'warning', exact: true }).click()
  const callout = expected.blocks.find(block => block.type === 'callout')
  if (callout !== undefined) {
    callout.props.tone = 'warning'
  }
  const formula = editor.locator('[data-inline-content-type="inlineMath"]')
  await formula.getByRole('button', { name: 'Edit formula', exact: true }).click()
  await page.getByRole('dialog', { name: 'Edit formula', exact: true })
    .getByLabel('Formula source', { exact: true })
    .fill('a^3')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  const paragraph = expected.blocks[0]
  if (Array.isArray(paragraph?.content)) {
    const math = paragraph.content.find(item => item.type === 'inlineMath')
    if (math?.type === 'inlineMath') {
      math.props.source = 'a^3'
    }
  }
  await semanticCheckpoint(page, info, journey, { name: 'mixed-formatted', id: ack.documentId, expected })
}

async function reorderAndEditTable(state: State): Promise<void> {
  const { page, journey, info, expected, ack, editor, bullet, numbered, table } = state

  const source = editor.locator('[data-content-type="bulletListItem"]')
  const target = editor.locator('[data-content-type="numberedListItem"]')
  await source.scrollIntoViewIfNeeded()
  await source.hover()
  await dragWithMediaEvidence(page, journey, page.getByRole('button', { name: 'Open block menu', exact: true }), target)
  const from = expected.blocks.indexOf(bullet)
  expected.blocks.splice(from, 1)
  expected.blocks.splice(expected.blocks.indexOf(numbered) + 1, 0, bullet)
  await saved(page)
  await source.locator('.bn-inline-content').click()
  await expect(editor).toBeFocused()
  await expect(editor.locator('.ProseMirror-selectednode')).toHaveCount(0)
  await page.keyboard.press('Tab')
  await saved(page)
  const nested = await opened(page, ack.documentId)
  expect(nested.document.blocks.find(block => block.id === numbered.id)?.children.map(block => block.id))
    .toContain(bullet.id)
  await page.keyboard.press('Shift+Tab')
  const grid = editor.locator('table')
  await grid.getByText('Journey cell', { exact: true }).fill('Journey changed cell')
  if (table.content !== undefined && !Array.isArray(table.content)) {
    const row = table.content.rows[0]
    if (row !== undefined) {
      const cell = row.cells[0]
      if (cell !== undefined && !Array.isArray(cell)) {
        cell.content = inline('Journey changed cell')
      }
    }
  }
  await tableWidgets(grid).locator('.editor-table-caption button').click()
  const caption = tableWidgets(grid).getByRole('textbox', { name: 'Table caption', exact: true })
  await caption.fill('Journey revised table caption')
  await caption.press('Enter')
  expected.tableAccessibility[table.id] = { caption: 'Journey revised table caption' }
  await semanticCheckpoint(page, info, journey, { name: 'mixed-structure', id: ack.documentId, expected })
}

async function replaceImage(state: State): Promise<void> {
  const { page, journey, info, expected, ack, identity, image } = state

  for (const filename of ['journey-replacement-one.png', 'journey-replacement-two.png']) {
    const edit = await editImage(page)
    await edit.getByLabel('Alternative text', { exact: true }).fill('Journey retained description')
    const response = page.waitForResponse(result => result.request().method() === 'PUT'
      && /\/api\/admin\/assets\/[^/]+\/content$/.test(new URL(result.url()).pathname))
    await uploadFile(edit, { name: filename, mimeType: 'image/png', buffer: png })
    const ready = assetDescriptorSchema.parse(await (await response).json())
    image.props.url = ready.url
    image.props.name = filename
    const accessibility = expected.mediaAccessibility[image.id]
    if (accessibility !== undefined) {
      accessibility.alt = 'Journey retained description'
    }
    await edit.getByRole('button', { name: 'Close', exact: true }).click()
    await semanticCheckpoint(page, info, journey, { name: filename, id: ack.documentId, expected })
  }
  expect(await identity.evaluate(element => element.isConnected)).toBe(true)
}

async function editReferenceAndReopen(state: State): Promise<void> {
  const { page, journey, info, expected, ack } = state

  await settingsTab(page, 'Content')
  await page.getByRole('button', { name: /^References \(/ }).click()
  await page.getByRole('button', { name: 'Edit reference: Journey source', exact: true }).click()
  const reference = page.getByRole('dialog', { name: 'Edit reference', exact: true })
  await reference.getByLabel('Reference title', { exact: true }).fill('Journey revised source')
  await editAuthor(reference, 1, 'Augusta Ada King')
  await addAuthor(reference, 'Grace Hopper')
  await reference.getByRole('button', { name: 'Save', exact: true }).click()
  const ref = expected.references[0]
  if (ref !== undefined) {
    ref.title = 'Journey revised source'
    ref.authors = ['Augusta Ada King', 'Grace Hopper']
  }
  await semanticCheckpoint(page, info, journey, { name: 'mixed-references', id: ack.documentId, expected })
  await previewCheckpoint(page, 'Journey revised heading')
  await previewCheckpoint(page, 'Journey revised source')
  await documentAction(page, 'View and compare revisions')
  await expect(page.getByRole('heading', { name: 'Revision history', exact: true })).toBeVisible()
  await layoutCheckpoint(page, info, journey, 'mixed-history')
  await page.getByRole('link', { name: 'Back to editor', exact: true }).click()
  await semanticCheckpoint(page, info, journey, { name: 'mixed-reopened', id: ack.documentId, expected })
  await expectMixedEditor(state.editor, expected)
}

async function publishMixedContent(state: State): Promise<void> {
  const { page, context, journey, info, expected, ack } = state

  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  const reader = await context.newPage()
  await reader.goto('/posts/journey-mixed')
  await expect(reader.getByRole('heading', { name: 'Journey revised heading', exact: true })).toBeVisible()
  await expect(reader.locator('.reader .callout')).toHaveAttribute('data-tone', 'warning')
  await expect(reader.getByRole('img', { name: 'Journey retained description', exact: true })).toBeVisible()
  await expect(reader.locator('table')).toContainText('Journey changed cell')
  await expect(reader.locator('caption')).toHaveText('Journey revised table caption')
  await expect(reader.locator('math')).toHaveCount(2)
  await expect(reader.locator('.reader')).toContainText('Journey revised source')
  await expect(reader.locator('.reader')).toContainText('Grace Hopper')
  await expectMixedReader(reader.locator('.reader-body'), expected)
  await layoutCheckpoint(reader, info, journey, 'mixed-public-reader')
  await reader.close()
  await navigation(page, 'Documents')
  await page.getByRole('link', { name: 'Journey mixed content', exact: true }).click()
  await semanticCheckpoint(page, info, journey, { name: 'mixed-final', id: ack.documentId, expected })
  await expectMixedEditor(state.editor, expected)
  await documentAction(page, 'Preview')
  const preview = page.getByRole('dialog', { name: 'Draft preview', exact: true })
  await expectMixedReader(preview.locator('.reader-body'), expected)
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
  await expectReleased(page, page.getByRole('button', { name: 'More document actions', exact: true }))
}

async function reviewMixedDocument(state: State): Promise<void> {
  const { page, editor, expected } = state
  for (const type of new Set(expected.blocks.map(block => block.type))) {
    await expect(editor.locator(`[data-content-type="${type}"]`).first()).toBeAttached()
  }
  await expectMixedEditor(editor, expected)
  const image = editor.locator('[data-content-type="image"] img')
  await image.scrollIntoViewIfNeeded()
  await expect.poll(async () => await image.evaluate(node =>
    node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0)).toBe(true)
  const diagram = editor.locator('[data-content-type="mermaid"]')
  await diagram.scrollIntoViewIfNeeded()
  await expect(page.frameLocator('iframe[title="Journey diagram"]').locator('svg')).toBeVisible()
  await editor.locator('[data-content-type="heading"]').scrollIntoViewIfNeeded()
}

async function editImage(page: import('@playwright/test').Page) {
  await page.locator('[data-content-type="image"] img').click()
  await page.getByRole('toolbar', { name: 'Editor actions', exact: true })
    .getByRole('button', { name: 'Edit media', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Edit media', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}
