import type { Locator, Page } from '@playwright/test'
import {
  addAuthor,
  expectAuthors,
  replaceAuthors,
} from '~/tests/browser/references/reference-author-helpers'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { mountEditorWorkspace } from '../support/editor-workspace-ui'
import { addReference, openReferenceList } from '../support/reference-ui'
import { expect, test } from '../support/test'

/**
 * Author ordering, validation and draft state are proved in jsdom. These browser
 * cases retain native pointer drag, focus delivery, viewport geometry and axe
 * results against the rendered surface.
 */

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
  test(`native author drag, bounds and axe hold at ${width}px`, async ({ page }, info) => {
    const api = await mountEditorWorkspace(page, {
      document: editorWorkspaceDocument('Author list'),
      width,
    })
    try {
      const list = await openReferenceList(page)
      const dialog = await addReference(page, list)
      await replaceAuthors(dialog, [
        'First',
        'Second',
        'Third',
      ])
      await drag(page, dialog)
      await expectAuthors(dialog, [
        'Second',
        'Third',
        'First',
      ])
      expect(await dialog.locator('[data-slot="reference-authors"]')
        .evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await assertAccessible(page, info, { label: `author-list-${width}` })
      await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('author validation delivers native focus to required controls', async ({ page }) => {
  const api = await mountEditorWorkspace(page, {
    document: editorWorkspaceDocument('Author limits'),
  })
  try {
    const list = await openReferenceList(page)
    const dialog = await addReference(page, list)
    await dialog.getByLabel('Reference title', { exact: true }).fill('Author limits')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Add author', exact: true })).toBeFocused()
    await addAuthor(dialog, `${'A'.repeat(201)}\nSecond`)
    const authorEditor = page.getByRole('dialog', { name: 'Add author', exact: true })
    await expect(authorEditor.getByLabel('Author name', { exact: true })).toBeFocused()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

/** Native focus and scroll return from the nested author editor. */
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
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(editor.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
  await assertAccessible(page, info, { label: 'author-edit-page' })
  await input.fill('Discard this name')
  await editor.getByRole('button', { name: 'Back to reference', exact: true }).click()
  await expect(editor.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused()
  await editor.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(input).toBeFocused()
  await page.keyboard.press('Escape')
  await editor.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(name).toBeFocused()
  await expect.poll(async () => await scroll.evaluate(element => element.scrollTop)).toBeCloseTo(position, 0)
}

async function checkAddCancel(page: Page, reference: Locator): Promise<void> {
  await reference.getByRole('button', { name: 'Add author', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Add author', exact: true })
  await editor.getByRole('button', { name: 'Back to reference', exact: true }).click()
  await expect(reference.getByRole('button', { name: 'Add author', exact: true })).toBeFocused()
  await reference.getByRole('button', { name: 'Add author', exact: true }).click()
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editor.getByLabel('Author name', { exact: true })).toBeFocused()
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(reference.getByRole('button', { name: 'Add author', exact: true })).toBeFocused()
}

for (const width of [
  320,
  390,
  1440,
]) {
  test(`author subpages retain native focus, scroll and reachability at ${width}px`, async ({ page }, info) => {
    const api = await mountEditorWorkspace(page, {
      document: editorWorkspaceDocument('Author subpages'),
      width,
    })
    try {
      const list = await openReferenceList(page)
      const reference = await addReference(page, list)
      await reference.getByLabel('Reference title', { exact: true }).fill('Parent draft stays')
      await replaceAuthors(reference, ['Ada Lovelace', 'Grace Hopper'])
      await checkAuthorDraft(page, reference, info)
      await checkAddCancel(page, reference)
      await reference.getByRole('button', { name: 'Cancel', exact: true }).click()
      await reference.getByRole('button', { name: 'Discard changes', exact: true }).click()
      if (width < 1100) {
        await expect(page.getByRole('dialog', { name: 'Document settings', exact: true })).toBeVisible()
      }
      else {
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}
