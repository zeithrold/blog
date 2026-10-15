import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { emptyDocument } from '../../src/content/document'
import { assertAccessible } from './accessibility'
import { settingsTab, writeDocument } from './helpers'
import { expectAuthors, replaceAuthors } from './reference-author-helpers'

async function checkAuthorDraft(page: Page, reference: Locator, info: TestInfo): Promise<void> {
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
    await page.setViewportSize({ width, height: 740 })
    await writeDocument(page, emptyDocument())
    await settingsTab(page, 'Content')
    await page.getByRole('button', { name: /^References \(/ }).click()
    await page.getByRole('button', { name: 'Add reference', exact: true }).click()
    const reference = page.getByRole('dialog', { name: 'Add reference', exact: true })
    await reference.getByLabel('Reference title', { exact: true }).fill('Parent draft stays')
    await replaceAuthors(reference, ['Ada Lovelace', 'Grace Hopper'])
    await expect(reference.locator('[data-slot="reference-authors"] input, [data-slot="reference-authors"] textarea'))
      .toHaveCount(0)
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
  })
}
