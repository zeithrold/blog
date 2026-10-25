import type { Locator, Page } from '@playwright/test'
import {
  editorWorkspaceDocument,
  emptyFileBlock,
  mermaidBlock,
  registerEmptyMedia,
} from '../support/editor-workspace-fixtures'
import { editorReady, mountEditorWorkspace, openPublicationTab } from '../support/editor-workspace-ui'
import { expect, test } from '../support/test'

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

// The issue list is a live view of the document the author is editing: fixing a
// block clears its reason without a save, and a block that still has no file
// keeps its own.
test('publication preflight updates when diagram source and empty media change', async ({ page }) => {
  const fileId = crypto.randomUUID()
  const document = editorWorkspaceDocument('Live publication preflight', (body) => {
    body.blocks.push(mermaidBlock('unsupported diagram'), emptyFileBlock(fileId))
    registerEmptyMedia(body, fileId)
  })
  const api = await mountEditorWorkspace(page, { document })
  try {
    await editorReady(page)
    await openPublicationTab(page, 'en')
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
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
