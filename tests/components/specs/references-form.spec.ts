import { assertAccessible } from '~/tests/support/browser/accessibility'
import { settingsTab } from '~/tests/support/browser/settings'
import { editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { editorReady, mountEditorWorkspace } from '../support/editor-workspace-ui'
import { citedReferenceDocument, referenceSaveRoute } from '../support/reference-fixtures'
import {
  addReference,
  dialogLayout,
  draftCommitted,
  openReferenceList,
  settled,
} from '../support/reference-ui'
import { expect, test } from '../support/test'

/**
 * Form state and validation are proved in jsdom. These component cases retain
 * only the real drawer/page boundary, native focus delivery, CSS geometry and
 * axe scans against computed styles.
 */

// Below 1100px the reference editor is a page of the settings drawer instead of
// its own dialog: the drawer is the only dialog, and leaving the page restores
// both the drawer's heading and the list's scroll position.
for (const width of [320, 390]) {
  test(`reference pages share one drawer and restore settings at ${width}px`, async ({ page }, info) => {
    const api = await mountEditorWorkspace(page, {
      document: editorWorkspaceDocument('Reference drawer'),
      width,
    })
    try {
      await editorReady(page)
      // The original case measured the drawer at 740px, where the settings list
      // is taller than the drawer and its scroll position is observable.
      await page.setViewportSize({ width, height: 740 })
      await settingsTab(page, 'Content')
      const drawer = page.locator('.inspector-drawer')
      await drawer.getByRole('button', { name: /^References \(/u }).click()
      const add = drawer.getByRole('button', { name: 'Add reference', exact: true })
      await add.scrollIntoViewIfNeeded()
      const viewport = drawer.locator('.inspector-scroll .ztd-scroll-viewport')
      const position = await viewport.evaluate(element => element.scrollTop)
      await add.click()
      const editor = page.getByRole('dialog', { name: 'Add reference', exact: true })
      await expect(page.getByRole('dialog')).toHaveCount(1)
      await expect(page.locator('.reference-dialog')).toHaveCount(0)
      await expect(editor.getByLabel('DOI', { exact: true })).toBeFocused()
      await settled(editor)
      await expect(editor.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
      await editor.getByRole('button', { name: 'Back to document settings', exact: true }).click()
      await expect(drawer).toHaveAccessibleName('Document settings')
      await expect(add).toBeFocused()
      await expect.poll(async () => await viewport.evaluate(element => element.scrollTop)).toBeCloseTo(position, 0)
      await add.click()
      await settled(editor)
      await editor.getByLabel('Reference title', { exact: true }).fill('Unsaved reference')
      await editor.getByRole('button', { name: 'Back to document settings', exact: true }).click()
      await expect(editor.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused()
      await expect(page.getByRole('dialog')).toHaveCount(1)
      await assertAccessible(page, info, { label: `reference-discard-${width}` })
      await editor.getByRole('button', { name: 'Keep editing', exact: true }).click()
      await expect(editor.getByLabel('Reference title', { exact: true })).toBeFocused()
      await page.keyboard.press('Escape')
      await editor.getByRole('button', { name: 'Discard changes', exact: true }).click()
      await expect(drawer).toHaveAccessibleName('Document settings')
      await expect(add).toBeFocused()
      await expect.poll(async () => await viewport.evaluate(element => element.scrollTop)).toBeCloseTo(position, 0)
      await drawer.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

// The jsdom successor covers form values, validation and revision packets. The
// cases below keep only native dialog geometry and axe results across widths.
for (const width of [
  320,
  390,
  1440,
]) {
  test(`reference form geometry and focus return hold at ${width}px`, async ({ page }, info) => {
    const document = citedReferenceDocument('Reference form geometry')
    const existingTitle = document.document.references[0]?.title
    if (existingTitle === undefined) {
      throw new Error('The reference focus fixture has no reference')
    }
    const api = await mountEditorWorkspace(page, {
      document,
      width,
      writes: referenceSaveRoute,
    })
    try {
      const list = await openReferenceList(page)
      const editor = await addReference(page, list)
      await dialogLayout(editor, page, info, width)

      await editor.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(editor.getByLabel('Reference title', { exact: true })).toBeFocused()
      await expect(editor.getByLabel('Reference title', { exact: true })).toHaveAttribute('aria-invalid', 'true')
      const add = list.getByRole('button', { name: 'Add reference', exact: true })
      await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(add).toBeFocused()

      const edit = list.getByRole('button', { name: `Edit reference: ${existingTitle}`, exact: true })
      await edit.click()
      const editDialog = page.getByRole('dialog', { name: 'Edit reference', exact: true })
      await expect(editDialog.getByLabel('Reference title', { exact: true })).toBeFocused()
      await editDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(edit).toBeFocused()

      await edit.click()
      const saveDialog = page.getByRole('dialog', { name: 'Edit reference', exact: true })
      await saveDialog.getByLabel('Reference title', { exact: true }).fill('Saved focus reference')
      const revisionWrite = page.waitForRequest(request =>
        request.method() === 'PUT' && request.url().endsWith('/revisions'))
      await saveDialog.getByRole('button', { name: 'Save', exact: true }).click()
      const savedEdit = list.getByRole('button', { name: 'Edit reference: Saved focus reference', exact: true })
      await expect(savedEdit).toBeFocused()
      await revisionWrite
      await draftCommitted(page)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
