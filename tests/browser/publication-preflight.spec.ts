import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { emptyDocument } from '../../src/content/document'
import { settingsTab, writeDocument } from './helpers'

async function replaceSource(page: Page, diagram: Locator, source: string): Promise<void> {
  const input = diagram.locator('code[aria-label]')
  await input.click()
  await page.keyboard.press('ControlOrMeta+A')
  const lines = source.split('\n')
  for (const [index, line] of lines.entries()) {
    if (index > 0) {
      await page.keyboard.press('Enter')
    }
    await page.keyboard.insertText(line)
  }
  await expect(input).toHaveText(source)
}

test('publication preflight updates when diagram source and empty media change', async ({ page }) => {
  const document = emptyDocument()
  document.meta.title = 'Live publication preflight'
  document.meta.slug = `live-preflight-${crypto.randomUUID()}`
  const fileId = crypto.randomUUID()
  document.blocks.push({
    id: crypto.randomUUID(),
    type: 'mermaid',
    props: { description: '' },
    children: [],
    content: [
      { type: 'text', text: 'unsupported diagram', styles: {} },
    ],
  }, {
    id: fileId,
    type: 'file',
    props: { url: '', name: '', caption: '', backgroundColor: 'default' },
    children: [],
  })
  document.mediaAccessibility[fileId] = {
    alt: '',
    decorative: false,
    transcript: '',
    captionAssetId: null,
    posterAssetId: null,
  }
  await writeDocument(page, document)
  await settingsTab(page, 'Publication')
  const issues = page.locator('.publication-issues')
  const descriptions = issues.locator('[data-publication-description]')
  const diagramIssue = 'Fix empty or unsupported diagram content before publishing.'
  const sourceIssue = 'Select a file for each empty media block, or remove the block.'
  await expect(descriptions).toHaveText([diagramIssue, sourceIssue])
  const body = page.getByLabel('Document body', { exact: true })
  const diagram = body.locator('[data-content-type="mermaid"]')
  await diagram.getByRole('button', { name: 'Edit diagram', exact: true }).click()
  await replaceSource(page, diagram, 'graph TD\nA-->B')
  await expect(descriptions).toHaveText([sourceIssue])
  await replaceSource(page, diagram, 'unsupported again')
  await expect(descriptions).toHaveText([diagramIssue, sourceIssue])
  await replaceSource(page, diagram, 'graph TD\nA-->B')
  await diagram.getByRole('button', { name: 'Done', exact: true }).click()
  const file = body.locator('[data-content-type="file"]')
  await file.evaluate(element => element.scrollIntoView({ block: 'center' }))
  await file.hover()
  await page.getByRole('button', { name: 'Open block menu', exact: true }).click()
  await page.locator('.editor-block-action-list').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(issues).toHaveCount(0)
})
