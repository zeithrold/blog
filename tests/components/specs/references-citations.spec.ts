import { mountEditorWorkspace } from '../support/editor-workspace-ui'
import {
  citedTableDocument,
  referenceSaveRoute,
  tableCellText,
  workspaceDocument,
  writtenDocuments,
} from '../support/reference-fixtures'
import { openReferenceList } from '../support/reference-ui'
import { expect, test } from '../support/test'

/**
 * The list refuses to remove a reference the body cites, and the citation here
 * sits inside a table cell: replacing that cell in the real table editor is what
 * clears the guard, and the save then carries the uncited list and the new cell.
 *
 * A stored table can hold a cell two ways, as inline content or as a `tableCell`
 * node; `tests/unit/editor-native.test.ts` proves the citation is found in both
 * shapes, so these cases drive the editor and the save.
 */
for (const structured of [false, true]) {
  test(`editing a native table citation unlocks removal (${structured ? 'structured' : 'array'})`, async ({ page }) => {
    const api = await mountEditorWorkspace(page, {
      document: workspaceDocument('Table citation', citedTableDocument(structured).document),
      writes: referenceSaveRoute,
    })
    try {
      const list = await openReferenceList(page)
      const remove = list.getByRole('button', { name: 'Remove reference: Cited in a table', exact: true })
      const cell = page.getByLabel('Document body', { exact: true }).locator('td').first()
      await cell.locator('p').fill('Replaced citation')
      await expect(remove).toBeEnabled()
      await expect(cell).toContainText('Replaced citation')
      await remove.click()
      await expect.poll(() => writtenDocuments(api.calls).at(-1)?.references ?? null).toEqual([])
      const saved = writtenDocuments(api.calls).at(-1)
      if (saved === undefined) {
        throw new Error('Missing saved document')
      }
      // The save carries the edit and the reference that is no longer cited.
      expect(tableCellText(saved)).toBe('Replaced citation')
      expect(saved.references).toEqual([])
      await expect(list.getByRole('button', { name: 'Remove reference: Cited in a table', exact: true }))
        .toHaveCount(0)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
