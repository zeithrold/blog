import type { Locator, Page } from '@playwright/test'
import type { ApiCall } from '../support/http-fixtures'
import {
  addAuthor,
  authorAction,
  editAuthor,
  expectAuthors,
  pasteAuthors,
  replaceAuthors,
} from '~/tests/browser/references/reference-author-helpers'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { mountEditorWorkspace } from '../support/editor-workspace-ui'
import { referenceSaveRoute, writtenReferences } from '../support/reference-fixtures'
import { addReference, draftCommitted, openReferenceList } from '../support/reference-ui'
import { expect, test } from '../support/test'

/**
 * Author rows are the one reference field that is a list, so every case here
 * drives the real author list: the row buttons, the drag handle's pointer
 * gesture, the keyboard reorder and the author editor page.
 *
 * Saving ends in one revision write, which the case answers with a format-only
 * acknowledgement and then asserts on. Storing the reference is the retained
 * E2E case's job.
 */

/** The author list each save carried: the copy a real save would have stored. */
function savedAuthors(calls: readonly ApiCall[]): string[][] {
  return calls.filter(call => call.method === 'PUT')
    .map(call => writtenReferences(call)[0]?.authors ?? [])
}

/**
 * Pastes two names on separate lines into a new author page: the author editor
 * splits them, trims the surrounding spaces and keeps both rows.
 */
async function pasteTwoAuthors(page: Page, dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: 'Add author', exact: true }).click()
  const authorEditor = page.getByRole('dialog', { name: 'Add author', exact: true })
  await expect(authorEditor.getByLabel('Author name', { exact: true })).toBeFocused()
  await pasteAuthors(
    authorEditor.getByLabel('Author name', { exact: true }),
    ' \u5F20\u4E09\r\n\r\nResearch Institute ',
  )
  await authorEditor.getByRole('button', { name: 'Save', exact: true }).click()
}

async function drag(page: Page, dialog: Locator): Promise<void> {
  const handle = dialog.getByRole('button', { name: 'Reorder author 1', exact: true })
  await handle.scrollIntoViewIfNeeded()
  const source = await handle.boundingBox()
  const target = await dialog.locator('[data-author-row]').nth(2).boundingBox()
  if (source === null || target === null) {
    throw new Error('Missing drag bounds')
  }
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + source.width / 2, target.y + target.height / 2, { steps: 8 })
  await page.mouse.up()
}

for (const width of [
  320,
  390,
  1440,
]) {
  test(`author rows edit, paste, reorder and save at ${width}px`, async ({ page }, info) => {
    const api = await mountEditorWorkspace(page, {
      document: editorWorkspaceDocument('Author list'),
      width,
      writes: referenceSaveRoute,
    })
    try {
      const list = await openReferenceList(page)
      const dialog = await addReference(page, list)
      await dialog.getByLabel('Reference title', { exact: true }).fill('Author list interaction')
      await replaceAuthors(dialog, [
        'Ada Lovelace',
        'Grace Hopper',
        'Doe, Jane',
      ])
      await editAuthor(dialog, 1, 'Augusta Ada King')
      await drag(page, dialog)
      await expectAuthors(dialog, [
        'Grace Hopper',
        'Doe, Jane',
        'Augusta Ada King',
      ])
      await dialog.getByRole('button', { name: 'Reorder author 3', exact: true }).press('ArrowUp')
      await expectAuthors(dialog, [
        'Grace Hopper',
        'Augusta Ada King',
        'Doe, Jane',
      ])
      await authorAction(dialog, 'Move author 2 up')
      await authorAction(dialog, 'Remove author 2')
      await pasteTwoAuthors(page, dialog)
      const expected = [
        'Augusta Ada King',
        'Doe, Jane',
        '张三',
        'Research Institute',
      ]
      await expectAuthors(dialog, expected)
      // A draft is local: reordering and adding authors wrote nothing, so the
      // stored document still holds the reference list it was opened with.
      expect(api.calls.filter(call => call.method !== 'GET')).toEqual([])
      expect(await dialog.locator('[data-slot="reference-authors"]')
        .evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await assertAccessible(page, info, { label: `author-list-${width}` })
      await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
      await page.screenshot({ path: info.outputPath(`author-list-${width}.png`) })
      await dialog.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect.poll(() => savedAuthors(api.calls)).toEqual([expected])
      await draftCommitted(page)
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('author limits, expanded rows and duplicate names retain their identity', async ({ page }) => {
  const api = await mountEditorWorkspace(page, {
    document: editorWorkspaceDocument('Author limits'),
    writes: referenceSaveRoute,
  })
  try {
    const list = await openReferenceList(page)
    const dialog = await addReference(page, list)
    await dialog.getByLabel('Reference title', { exact: true }).fill('Author limits')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Add author', exact: true })).toBeFocused()
    await replaceAuthors(dialog, ['Duplicate', 'Duplicate'])
    await addAuthor(dialog, `${'A'.repeat(201)}\nSecond`)
    const authorEditor = page.getByRole('dialog', { name: 'Add author', exact: true })
    await expect(authorEditor.getByRole('alert')).toBeVisible()
    await authorEditor.getByLabel('Author name', { exact: true }).fill('Second')
    await expect(authorEditor.getByLabel('Author name', { exact: true })).toBeFocused()
    await authorEditor.getByRole('button', { name: 'Save', exact: true }).click()
    const more = Array.from({ length: 48 }, (_value, index) => `Name ${index}`)
    await addAuthor(dialog, more.join('\n'))
    await expect(authorEditor.getByRole('alert')).toBeVisible()
    expect(api.calls.filter(call => call.method !== 'GET')).toEqual([])
    await authorEditor.getByLabel('Author name', { exact: true }).fill(more.slice(0, 47).join('\n'))
    await authorEditor.getByRole('button', { name: 'Save', exact: true }).click()
    await dialog.getByRole('button', { name: 'Show fewer authors', exact: true }).click()
    await expect(dialog.locator('[data-author-name]')).toHaveCount(5)
    await dialog.getByRole('button', { name: 'Show all 50 authors', exact: true }).click()
    await expect(dialog.locator('[data-author-name]')).toHaveCount(50)
    await editAuthor(dialog, 2, 'Edited duplicate')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(() => savedAuthors(api.calls)).toHaveLength(1)
    const [stored] = savedAuthors(api.calls)
    expect(stored?.[1]).toBe('Edited duplicate')
    expect(stored?.[0]).toBe('Duplicate')
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

/**
 * An author is edited on its own page, so the reference draft has to survive
 * leaving it: the subtitle dialog is one dialog at a time, and returning puts
 * focus back on the author row the case left from.
 */
async function checkAuthorDraft(
  page: Page,
  reference: Locator,
  info: Parameters<typeof assertAccessible>[1],
): Promise<void> {
  const scroll = reference.locator('[data-slot="reference-form-scroll"]')
  const name = reference.locator('[data-author-name]').nth(1)
  await name.scrollIntoViewIfNeeded()
  const position = await scroll.evaluate(element => element.scrollTop)
  if ((page.viewportSize()?.width ?? 1440) < 1100) {
    await reference.getByRole('button', { name: 'Author 2 actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Edit author 2', exact: true }).click()
  }
  else {
    await reference.getByRole('button', { name: 'Edit author: Grace Hopper', exact: true }).last().click()
  }
  const editor = page.getByRole('dialog', { name: 'Edit author', exact: true })
  const input = editor.getByLabel('Author name', { exact: true })
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('Grace Hopper')
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(editor.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
  await assertAccessible(page, info, { label: 'author-edit-page' })
  await page.screenshot({ path: info.outputPath('author-edit-page.png') })
  await input.fill('Discard this name')
  await editor.getByRole('button', { name: 'Back to reference', exact: true }).click()
  await expect(editor.getByRole('alert')).toContainText('Discard author changes?')
  await expect(editor.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused()
  await editor.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(input).toHaveValue('Discard this name')
  await expect(input).toBeFocused()
  await page.keyboard.press('Escape')
  await editor.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expectAuthors(reference, ['Ada Lovelace', 'Grace Hopper'])
  await expect(name).toBeFocused()
  await expect.poll(async () => await scroll.evaluate(element => element.scrollTop)).toBeCloseTo(position, 0)
  await expect(reference.getByLabel('Reference title', { exact: true })).toHaveValue('Parent draft stays')
}

async function checkAddCancel(page: Page, reference: Locator): Promise<void> {
  await reference.getByRole('button', { name: 'Add author', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Add author', exact: true })
  await editor.getByRole('button', { name: 'Back to reference', exact: true }).click()
  await expectAuthors(reference, ['Ada Lovelace', 'Grace Hopper'])
  await expect(reference.getByRole('button', { name: 'Add author', exact: true })).toBeFocused()
  await reference.getByRole('button', { name: 'Add author', exact: true }).click()
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor.getByRole('alert')).toBeVisible()
  await expect(editor.getByLabel('Author name', { exact: true })).toBeFocused()
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expectAuthors(reference, ['Ada Lovelace', 'Grace Hopper'])
}

for (const width of [
  320,
  390,
  1440,
]) {
  test(`author subpages preserve the reference draft and one dialog at ${width}px`, async ({ page }, info) => {
    const api = await mountEditorWorkspace(page, {
      document: editorWorkspaceDocument('Author subpages'),
      width,
    })
    try {
      const list = await openReferenceList(page)
      const reference = await addReference(page, list)
      await reference.getByLabel('Reference title', { exact: true }).fill('Parent draft stays')
      await expect(reference.getByLabel('Reference title', { exact: true })).toHaveValue('Parent draft stays')
      await expect(reference.locator('input[name="doi"]')).toHaveValue('')
      await replaceAuthors(reference, ['Ada Lovelace', 'Grace Hopper'])
      await expect(reference.locator(
        '[data-slot="reference-authors"] input, [data-slot="reference-authors"] textarea',
      )).toHaveCount(0)
      await checkAuthorDraft(page, reference, info)
      await checkAddCancel(page, reference)
      await reference.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(reference.getByRole('alert')).toContainText('Discard reference changes?')
      await reference.getByRole('button', { name: 'Discard changes', exact: true }).click()
      if (width < 1100) {
        await expect(page.getByRole('dialog', { name: 'Document settings', exact: true })).toBeVisible()
      }
      else {
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
      // The whole case is a draft that is discarded, start to end.
      expect(api.calls.filter(call => call.method !== 'GET')).toEqual([])
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
