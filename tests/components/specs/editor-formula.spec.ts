import {
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceApi,
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
} from '../support/editor-workspace-fixtures'
import { serveApi } from '../support/http-fixtures'
import { mountSurface } from '../support/mount'
import { expect, test } from '../support/test'

for (const width of [1440, 390]) {
  test(`new inline formulas focus their source editor at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const open = editorWorkspaceDocument('Inline formula focus')
    const api = await serveApi(page, {
      ...editorWorkspaceApi(open),
      'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
    })
    try {
      await mountSurface(page, {
        surface: 'editor-workspace',
        route: `/admin/documents/${EDITOR_WORKSPACE_DOCUMENT_ID}`,
      })
      const body = page.getByLabel('Document body', { exact: true })
      await expect(body).toBeVisible()
      await body.pressSequentially('An inline formula ')
      await page.getByRole('button', { name: 'Inline formula', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Edit formula', exact: true })
      const source = dialog.getByLabel('Formula source', { exact: true })
      // Insertion from the native editor caret transfers focus to the formula source.
      await expect(source).toBeFocused()
      await page.keyboard.type('a^2')
      await expect(source).toHaveValue('a^2')
      await dialog.getByRole('button', { name: 'Done', exact: true }).click()

      const inlineMath = body.locator('[data-inline-content-type="inlineMath"]')
      await expect(inlineMath).toHaveCount(1)
      await expect(inlineMath.locator('math msup > mi')).toHaveText('a')
      await expect(inlineMath.locator('math msup > mn')).toHaveText('2')

      // Prove insertion at the browser-created caret without adding a new
      // focus-return contract after the settings dialog closes.
      const precedingText = await inlineMath.evaluate((inline) => {
        const paragraph = inline.closest('[data-content-type="paragraph"]')
        if (paragraph === null) {
          throw new Error('The inserted formula is not inside its paragraph')
        }
        const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
        let preceding = ''
        for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
          if (inline.contains(text)) {
            return preceding
          }
          preceding += text.textContent ?? ''
        }
        throw new Error('The inserted formula has no preview text')
      })
      expect(precedingText).toBe('An inline formula ')
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
