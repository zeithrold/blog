import type { Locator, Page, TestInfo } from '@playwright/test'
import type { ApiService } from '../support/http-fixtures'
import {
  addAuthor,
  discardReference,
  expectAuthors,
  replaceAuthors,
} from '~/tests/browser/references/reference-author-helpers'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { settingsTab } from '~/tests/support/browser/settings'
import { editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { editorReady, mountEditorWorkspace } from '../support/editor-workspace-ui'
import {
  attemptedWrites,
  citedReferenceDocument,
  referenceSaveRoute,
  writtenLists,
} from '../support/reference-fixtures'
import {
  addReference,
  dialogLayout,
  draftCommitted,
  openReferenceList,
  settled,
} from '../support/reference-ui'
import { expect, test } from '../support/test'

/**
 * The reference form: the drawer page that holds it below 1100px, the fields it
 * validates, and the list beside it that protects a cited record.
 *
 * A save ends in one revision write answered with a format-only
 * acknowledgement, and the case asserts the document that write carried.
 * Storing it, and reading it back after a reload, is
 * `tests/browser/references/reference-settings.spec.ts`.
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
      await page.getByLabel('Reference title', { exact: true }).fill('Unsaved reference')
      await replaceAuthors(editor, ['Author one', 'Author two'])
      await editor.getByRole('button', { name: 'Back to document settings', exact: true }).click()
      await expect(editor.getByRole('alert')).toContainText('Discard reference changes?')
      await expect(editor.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused()
      await expect(page.getByRole('dialog')).toHaveCount(1)
      await assertAccessible(page, info, { label: `reference-discard-${width}` })
      await editor.getByRole('button', { name: 'Keep editing', exact: true }).click()
      await expect(editor.getByLabel('Reference title', { exact: true })).toHaveValue('Unsaved reference')
      await expect(editor.getByLabel('Reference title', { exact: true })).toBeFocused()
      await expectAuthors(editor, ['Author one', 'Author two'])
      await page.keyboard.press('Escape')
      await expect(editor.getByRole('alert')).toBeVisible()
      await editor.getByRole('button', { name: 'Discard changes', exact: true }).click()
      await expect(drawer).toHaveAccessibleName('Document settings')
      await expect(add).toBeFocused()
      await expect.poll(async () => await viewport.evaluate(element => element.scrollTop)).toBeCloseTo(position, 0)
      await add.click()
      await expect(editor.getByLabel('Reference title', { exact: true })).toHaveValue('')
      await expectAuthors(editor, [])
      await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
      await drawer.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByLabel('Document body', { exact: true })).toBeVisible()
      expect(attemptedWrites(api)).toEqual([])
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

/**
 * A new draft starts empty in the DOI field, and discarding it writes nothing.
 * Saving it reports the two required fields at once, with focus on the title.
 */
async function emptyDraft(page: Page, list: Locator, api: ApiService): Promise<Locator> {
  const add = list.getByRole('button', { name: 'Add reference', exact: true })
  const dialog = await addReference(page, list)
  const title = dialog.getByLabel('Reference title', { exact: true })
  await expect(dialog.getByLabel('DOI', { exact: true })).toBeFocused()
  await expect(title).toHaveValue('')
  await expectAuthors(dialog, [])
  await title.fill('Discarded draft')
  await discardReference(dialog)
  await expect(dialog).toHaveCount(0)
  await expect(add).toBeFocused()
  expect(attemptedWrites(api)).toEqual([])
  await add.click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(title).toBeFocused()
  await expect(dialog.getByRole('alert')).toHaveCount(2)
  return dialog
}

/**
 * Year, DOI and URL are reported together, each with its own label. The year is
 * fractional on purpose: a whole year is a whole-year rule, and only a fraction
 * shows that a value the browser accepts is still refused by the schema. Both
 * engines keep it in the field (`stepMismatch`, not `badInput`), so one fill is
 * enough and the same label is expected everywhere.
 */
async function invalidValues(dialog: Locator): Promise<void> {
  const year = dialog.getByLabel('Year', { exact: true })
  const doi = dialog.getByLabel('DOI', { exact: true })
  const url = dialog.getByLabel('URL', { exact: true })
  await dialog.getByLabel('Reference title', { exact: true }).fill(' A Treatise on Reference Management ')
  await addAuthor(dialog, ' Ada Lovelace\n\n Grace Hopper ')
  await year.fill('2026.5')
  await doi.fill('invalid')
  await url.fill('javascript:alert(1)')
  await expect(year).toHaveValue('2026.5')
  await expect(doi).toHaveValue('invalid')
  await expect(url).toHaveValue('javascript:alert(1)')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(3)
}

/** Corrects the three validated values, reading each one back before the save. */
async function correctedValues(dialog: Locator): Promise<void> {
  const year = dialog.getByLabel('Year', { exact: true })
  const doi = dialog.getByLabel('DOI', { exact: true })
  const url = dialog.getByLabel('URL', { exact: true })
  await year.fill('2026')
  await doi.fill('10.1000/example')
  await url.fill('https://example.com/paper')
  await expect(year).toHaveValue('2026')
  await expect(doi).toHaveValue('10.1000/example')
  await expect(url).toHaveValue('https://example.com/paper')
}

// The form is the only place a reference is created or edited, so the case
// drives every field, its error label, the explicit save, and the cited record
// the list refuses to remove.
for (const width of [
  320,
  390,
  1440,
]) {
  test(`reference fields validate and the saved draft keeps cited records at ${width}px`, async ({ page }, info) => {
    const fixtureDocument = citedReferenceDocument('Reference management')
    const api = await mountEditorWorkspace(page, {
      document: fixtureDocument,
      width,
      writes: referenceSaveRoute,
    })
    try {
      const list = await openReferenceList(page)
      await expect(list.locator('input, textarea')).toHaveCount(0)
      await expect(list.getByRole('button', { name: 'Remove reference: Attention Is All You Need', exact: true }))
        .toBeDisabled()
      await expect(list).toContainText('Remove citations from the body before removing this reference.')
      const dialog = await emptyDraft(page, list, api)
      await invalidValues(dialog)
      expect(attemptedWrites(api)).toEqual([])
      await correctedValues(dialog)
      await dialog.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect(list.getByRole('button', { name: 'Add reference', exact: true })).toBeFocused()
      await expect.poll(() => writtenLists(api.calls).length).toBe(1)
      const created = writtenLists(api.calls)[0]
      expect(created?.[1]).toMatchObject({
        title: 'A Treatise on Reference Management',
        authors: ['Ada Lovelace', 'Grace Hopper'],
        year: 2026,
        doi: '10.1000/example',
        url: 'https://example.com/paper',
      })
      await expect(list.locator('.reference-item')).toHaveCount(2)
      await expect(list.locator('input, textarea')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath(`reference-list-${width}.png`) })
      await renamedReference({
        page,
        list,
        api,
        info,
        width,
        referenceId: created?.[1]?.id,
      })
      await list.getByRole('button', {
        name: 'Remove reference: A Practical Guide to Reference Management',
        exact: true,
      }).click()
      await expect.poll(() => writtenLists(api.calls).length).toBe(3)
      expect(writtenLists(api.calls)[2]).toEqual(fixtureDocument.document.references)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

/** Editing keeps the reference's identity, and cancelling it writes nothing. */
async function renamedReference(options: {
  page: Page
  list: Locator
  api: ApiService
  info: TestInfo
  width: number
  referenceId: string | undefined
}): Promise<void> {
  const { page, list, api, info, width, referenceId } = options
  const edit = list.getByRole('button', {
    name: 'Edit reference: A Treatise on Reference Management',
    exact: true,
  })
  await edit.click()
  const editor = page.getByRole('dialog', { name: 'Edit reference', exact: true })
  await expect(editor.getByLabel('Reference title', { exact: true })).toBeFocused()
  await editor.getByLabel('Reference title', { exact: true }).fill('Cancelled edit')
  await page.keyboard.press('Escape')
  await editor.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await expect(edit).toBeFocused()
  expect(writtenLists(api.calls)).toHaveLength(1)
  await edit.click()
  await editor.getByLabel('Reference title', { exact: true })
    .fill('A Practical Guide to Reference Management')
  await dialogLayout(editor, page, info, width)
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => writtenLists(api.calls).length).toBe(2)
  const edited = writtenLists(api.calls)[1]
  expect(edited?.[1]?.id).toBe(referenceId)
  expect(edited?.[1]?.title).toBe('A Practical Guide to Reference Management')
  await draftCommitted(page)
}
