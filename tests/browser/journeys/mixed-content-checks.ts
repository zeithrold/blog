import type { Locator } from '@playwright/test'
import type { Block, Document } from '@/content/document'
import { readerCodeColors, readerTypography } from '~/tests/support/browser/reader-presentation'
import { expect } from '~/tests/support/browser/test'

function blockIds(blocks: Block[]): string[] {
  return blocks.flatMap(block => [
    block.id,
    ...blockIds(block.children),
  ])
}

async function inlineMarkup(root: Locator): Promise<void> {
  await expect(root.getByText('bold', { exact: true })).toHaveCSS('font-weight', /[6-9]00|bold/)
  await expect(root.getByText('italic', { exact: true })).toHaveCSS('font-style', 'italic')
  await expect(root.getByText('underline', { exact: true })).toHaveCSS('text-decoration-line', /underline/)
  await expect(root.getByText('strike', { exact: true })).toHaveCSS('text-decoration-line', /line-through/)
  await expect(root.getByText('code', { exact: true })).toHaveJSProperty('tagName', 'CODE')
  await expect(root.getByRole('link', { name: 'Journey link', exact: true }))
    .toHaveAttribute('href', 'https://example.com')
}

export async function expectMixedEditor(editor: Locator, expected: Document): Promise<void> {
  // BlockNote repeats data-id on wrappers; deduplication retains native document order.
  expect(await editor.locator('[data-id]').evaluateAll(nodes =>
    Array.from(new Set(nodes.map(node => node.getAttribute('data-id')))))).toEqual(blockIds(expected.blocks))
  await inlineMarkup(editor)
  await expect(editor.locator('[data-style-type="textColor"][data-value="red"]')).toHaveText('colored ')
  await expect(editor.locator('[data-style-type="backgroundColor"][data-value="yellow"]')).toHaveText('highlighted ')
  await expect(editor.locator('table tr')).toHaveCount(2)
  await expect(editor.locator('table tr').first().locator('th, td')).toHaveCount(2)
}

export async function expectMixedReader(root: Locator, expected: Document): Promise<void> {
  // The draft preview mounts its reader lazily; opening the dialog alone is not readiness.
  await expect(root).toBeVisible()
  const rendered = expected.blocks.filter(block => block.type !== 'footnote')
  expect(await root.locator('[id^="block-"]').evaluateAll(nodes => nodes.map(node => node.id)))
    .toEqual(blockIds(rendered).map(id => `block-${id}`))
  await inlineMarkup(root)
  await readerTypography(root)
  for (const task of expected.blocks.filter(block => block.type === 'checkListItem')) {
    const checkbox = root.locator(`#block-${task.id}`).getByRole('checkbox')
    await expect(checkbox).toBeDisabled()
    await expect(checkbox).toBeChecked({ checked: task.props.checked === true })
  }
  await readerCodeColors(root.locator('pre[data-language="typescript"]'))
  await expect(root.locator('pre[data-language="typescript"] code')).toHaveText('const journey = true')
  await expect(root.locator('[data-text-color="red"]')).toHaveText('colored ')
  await expect(root.locator('[data-background-color="yellow"]')).toHaveText('highlighted ')
  await expect(root.locator('table tr')).toHaveCount(2)
  await expect(root.locator('table tr').first().locator('th')).toHaveCount(2)
  await expect(root.locator('table tr').nth(1).locator('td')).toHaveText(['Second row', '42'])
  const table = expected.blocks.find(block => block.type === 'table')
  const reference = expected.references[0]
  const note = expected.blocks.find(block => block.type === 'footnote')
  if (table === undefined || reference === undefined || note === undefined) {
    throw new Error('Mixed fixture must include table, reference and footnote')
  }
  await expect(root.locator('caption')).toHaveText(expected.tableAccessibility[table.id]?.caption ?? '')
  await expect(root.getByRole('link', { name: 'Reference 1', exact: true }))
    .toHaveAttribute('href', `#reference-${reference.id}`)
  await expect(root.getByRole('link', { name: 'Footnote 1', exact: true }))
    .toHaveAttribute('href', `#note-${note.id}`)
  await expect(root.locator(`#reference-${reference.id}`)).toContainText(reference.title)
  await expect(root.locator(`#note-${note.id}`)).toContainText('Journey footnote')
  await expect(root.locator('audio')).toHaveCount(1)
  await expect(root.locator('video')).toHaveCount(1)
  await root.locator('summary').filter({ hasText: 'Journey details' }).click()
  await expect(root.getByText('Journey nested paragraph', { exact: true })).toBeVisible()
  await root.locator('summary').filter({ hasText: 'Journey details' }).click()
}
