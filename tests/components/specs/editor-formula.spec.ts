import {
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceApi,
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
} from '../support/editor-workspace-fixtures'
import { serveApi } from '../support/http-fixtures'
import { mountSurface } from '../support/mount'
import { expect, test } from '../support/test'

// The inline formula the author inserts from the toolbar, and the source it types into it.
const inlineSource = 'a^2'

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
      // A new inline formula opens focused, so typing lands in its source without a click.
      await expect(source).toBeFocused()
      await page.keyboard.type(inlineSource)
      await expect(source).toHaveValue(inlineSource)
      await dialog.getByRole('button', { name: 'Done', exact: true }).click()
      await expect(body.locator('[data-inline-content-type="inlineMath"] math')).toContainText('2')
      // The revision packet the client sends carries the inline formula; storage stays E2E.
      await expect.poll(() => api.calls
        .filter(call => call.method !== 'GET')
        .some(call => JSON.stringify(call.json).includes('inlineMath'))).toBe(true)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
