import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

export async function expectAuthors(dialog: Locator, names: string[]): Promise<void> {
  await expect(dialog.locator('[data-author-name]')).toHaveCount(names.length)
  for (const [index, name] of names.entries()) {
    await expect(dialog.locator('[data-author-name]').nth(index)).toHaveText(name)
  }
}
export async function replaceAuthors(dialog: Locator, names: string[]): Promise<void> {
  while (await dialog.locator('[data-author-name]').count() > 0) {
    await authorAction(dialog, 'Remove author 1')
  }
  for (const name of names) {
    await addAuthor(dialog, name)
  }
}
export async function discardReference(dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await dialog.getByRole('button', { name: 'Discard changes', exact: true }).click()
}
export async function pasteAuthors(input: Locator, text: string): Promise<void> {
  await input.focus()
  await input.evaluate((element, content) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text', content)
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
  }, text)
}

export async function authorAction(dialog: Locator, action: string): Promise<void> {
  const button = dialog.getByRole('button', { name: action, exact: true })
  if (await button.isVisible()) {
    await button.click()
    return
  }
  const number = /author (\d+)/u.exec(action)?.[1]
  await dialog.getByRole('button', { name: `Author ${number ?? '1'} actions`, exact: true }).click()
  await dialog.page().getByRole('menuitem', { name: action, exact: true }).click()
}

export async function addAuthor(dialog: Locator, value: string): Promise<void> {
  await dialog.getByRole('button', { name: 'Add author', exact: true }).click()
  const editor = dialog.page().getByRole('dialog', { name: 'Add author', exact: true })
  await pasteAuthors(editor.getByLabel('Author name', { exact: true }), value)
  // Single-line synthetic paste has no default browser action.
  if (!/[\r\n]/u.test(value)) {
    await editor.getByLabel('Author name', { exact: true }).fill(value)
  }
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
}
export async function editAuthor(dialog: Locator, number: number, value: string): Promise<void> {
  await dialog.locator('[data-author-name]').nth(number - 1).click()
  const editor = dialog.page().getByRole('dialog', { name: 'Edit author', exact: true })
  await editor.getByLabel('Author name', { exact: true }).fill(value)
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
}
