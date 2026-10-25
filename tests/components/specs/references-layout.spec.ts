import type { Locator, Page } from '@playwright/test'
import { expectAuthors } from '~/tests/browser/references/reference-author-helpers'
import { settingsTab } from '~/tests/support/browser/settings'
import { editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { editorReady, mountEditorWorkspace } from '../support/editor-workspace-ui'
import {
  attemptedWrites,
  referenceSaveRoute,
  writtenLists,
} from '../support/reference-fixtures'
import { addReference, draftCommitted, openReferenceList } from '../support/reference-ui'
import { expect, test } from '../support/test'

/**
 * The settings layout chooses the side panel or the drawer, and rotating or
 * splitting the screen changes it without touching the drafts inside: the author
 * page and the reference keep their values until the author commits them.
 */

for (const startWidth of [1024, 1366]) {
  test(`reference and author drafts survive resizing from ${startWidth}px`, async ({ page }, info) => {
    const api = await mountEditorWorkspace(page, {
      document: editorWorkspaceDocument('Reference resize'),
      width: startWidth,
      writes: referenceSaveRoute,
    })
    try {
      const list = await openReferenceList(page)
      const editor = await addReference(page, list)
      await editor.getByLabel('Reference title', { exact: true }).fill('A reference kept through rotation')
      const author = await draftAuthor(page, editor)
      for (const width of [
        startWidth === 1024 ? 1366 : 320,
        startWidth,
      ]) {
        await page.setViewportSize({ width, height: 900 })
        await expect(author.getByLabel('Author name', { exact: true })).toHaveValue('Author kept through rotation')
        await expect(author.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await page.screenshot({ path: info.outputPath(`reference-resize-${startWidth}-${width}.png`) })
      }
      await author.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(editor.getByLabel('Reference title', { exact: true }))
        .toHaveValue('A reference kept through rotation')
      await expectAuthors(editor, ['Author kept through rotation'])
      await page.setViewportSize({ width: startWidth === 1024 ? 1366 : 320, height: 900 })
      await editor.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expectLayout(page, startWidth)
      await draftCommitted(page)
      await expect.poll(() => writtenLists(api.calls).length).toBe(1)
      expect(writtenLists(api.calls)[0]).toMatchObject([
        {
          title: 'A reference kept through rotation',
          authors: ['Author kept through rotation'],
        },
      ])
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

/** Opens the author page of the reference draft the case is filling in. */
async function draftAuthor(page: Page, editor: Locator): Promise<Locator> {
  await editor.getByRole('button', { name: 'Add author', exact: true }).click()
  const author = page.getByRole('dialog', { name: 'Add author', exact: true })
  await author.getByLabel('Author name', { exact: true }).fill('Author kept through rotation')
  return author
}

/** The layout the case's last width selects, after the save settles it. */
async function expectLayout(page: Page, startWidth: number): Promise<void> {
  if (startWidth === 1024) {
    await expect(page.locator('.document-settings')).toBeVisible()
  }
  else {
    await expect(page.getByRole('button', { name: 'Document settings', exact: true })).toBeVisible()
  }
}

// A drawer closed by growing the window stays closed when the window shrinks
// again: the layout does not reopen a panel the author did not ask for.
test('a settings drawer closed by resizing does not reopen on returning to mobile', async ({ page }) => {
  const api = await mountEditorWorkspace(page, {
    document: editorWorkspaceDocument('Drawer closed by resize'),
    width: 390,
  })
  try {
    await editorReady(page)
    await settingsTab(page, 'Content')
    await expect(page.getByRole('dialog', { name: 'Document settings', exact: true })).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.locator('.document-settings')).toBeVisible()
    await page.setViewportSize({ width: 390, height: 900 })
    await expect(page.getByRole('button', { name: 'Document settings', exact: true })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(attemptedWrites(api)).toEqual([])
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
