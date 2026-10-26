import { assertAccessible } from '~/tests/support/browser/accessibility'
import { expectPacketContent, formattingCopy, revisionWrites } from '../support/editor-formatting-fixtures'
import {
  linkedContent,
  linkSelected,
  linkSelection,
  linkText,
  openLinkWorkspace,
} from '../support/editor-link-remaining-fixtures'
import { expectNoLinkCommand, selectInlineRange } from '../support/editor-link-remaining-ui'
import {
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
  paragraphBlock,
} from '../support/editor-workspace-fixtures'
import { mountEditorWorkspace } from '../support/editor-workspace-ui'
import { defer, failure } from '../support/http-fixtures'
import { expect, test } from '../support/test'

test.describe('touch link entry', () => {
  test.use({ hasTouch: true })

  test('the mobile formatting drawer hands a touch selection to the link dialog in dark zh', async ({ page }, info) => {
    const destination = '/posts/internal-target#part'
    const copy = formattingCopy.zh
    const { api, body } = await openLinkWorkspace(page, { locale: 'zh', width: 390, mode: 'dark' })
    try {
      await selectInlineRange(page, body, linkSelection, linkSelected)
      await page.getByRole('button', { name: copy.more, exact: true }).tap()
      await page.getByRole('dialog', { name: copy.drawer, exact: true })
        .getByRole('button', { name: copy.dialog, exact: true })
        .tap()
      const dialog = page.getByRole('dialog', { name: copy.dialog, exact: true })
      await expect(page.locator('.formatting-options-drawer')).toHaveCount(0)
      const url = dialog.getByRole('textbox', { name: copy.url, exact: true })
      await expect(url).toBeFocused()
      await url.fill(destination)
      await assertAccessible(page, info, { label: 'touch-link-dialog-dark-zh' })
      await dialog.getByRole('button', { name: copy.save, exact: true }).tap()
      await expect(dialog).toHaveCount(0)
      await expect(body).toBeFocused()
      await expectPacketContent(api, linkedContent(destination))
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
})

// The publication reply is held so the case observes the real pending state, and the
// shortcut is pressed against the read-only body the product renders while it waits.
test('a held publication makes the compact editor read-only and rejects link shortcuts', async ({ page }) => {
  const held = defer()
  const open = editorWorkspaceDocument('Busy links', (document) => {
    document.blocks = [
      paragraphBlock(linkText),
    ]
  })
  const api = await mountEditorWorkspace(page, {
    document: open,
    width: 390,
    writes: {
      'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
      'POST /api/admin/documents/:id/publish': async () => {
        await held.promise
        return failure(503, 'QA_REQUEST_NOT_EXECUTED')
      },
    },
  })
  const copy = formattingCopy.en
  const body = page.getByLabel(copy.body, { exact: true })
  try {
    await expect(body).toBeVisible()
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(body).toHaveAttribute('contenteditable', 'false')
    await selectInlineRange(page, body, linkSelection, linkSelected)
    await expectNoLinkCommand(page, 'en')
    expect(revisionWrites(api)).toEqual([])
  }
  finally {
    held.open()
    await expect(body).toHaveAttribute('contenteditable', 'true')
    await api.dispose()
  }
  await expect(body).toHaveText(linkText)
  await expect(page.getByRole('dialog', { name: copy.dialog, exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: copy.url, exact: true })).toHaveCount(0)
})
