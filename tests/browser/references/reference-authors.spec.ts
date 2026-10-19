import type { Locator, Page } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { openDocumentSchema } from '@/contracts/documents'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { writeDocument } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'
import {
  addAuthor,
  authorAction,
  editAuthor,
  expectAuthors,
  pasteAuthors,
  replaceAuthors,
} from './reference-author-helpers'

async function start(page: Page): Promise<string> {
  const document = emptyDocument()
  document.meta.title = 'Author list'
  const ack = await writeDocument(page, document)
  await settingsTab(page, 'Content')
  await page.getByRole('button', { name: /^References \(/ }).click()
  await page.getByRole('button', { name: 'Add reference', exact: true }).click()
  await page.getByLabel('Reference title', { exact: true }).fill('Author list interaction')
  return ack.documentId
}
async function authors(page: Page, id: string): Promise<string[]> {
  const response = await page.request.get(`/api/admin/documents/${id}`)
  return openDocumentSchema.parse(await response.json()).document.references[0]?.authors ?? []
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
  test(`author rows edit, paste, reorder and persist at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const id = await start(page)
    const dialog = page.getByRole('dialog', { name: 'Add reference', exact: true })
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
    await dialog.getByRole('button', { name: 'Add author', exact: true }).click()
    const authorEditor = page.getByRole('dialog', { name: 'Add author', exact: true })
    await expect(authorEditor.getByLabel('Author name', { exact: true })).toBeFocused()
    await pasteAuthors(authorEditor.getByLabel('Author name', { exact: true }), ' 张三\r\n\r\nResearch Institute ')
    await authorEditor.getByRole('button', { name: 'Save', exact: true }).click()
    const expected = [
      'Augusta Ada King',
      'Doe, Jane',
      '张三',
      'Research Institute',
    ]
    await expectAuthors(dialog, expected)
    expect(await authors(page, id)).toEqual([])
    expect(await dialog.locator('[data-slot="reference-authors"]')
      .evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await assertAccessible(page, info, { label: `author-list-${width}` })
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
    await page.screenshot({ path: info.outputPath(`author-list-${width}.png`) })
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(async () => await authors(page, id), { timeout: 15000 }).toEqual(expected)
    await page.reload()
    expect(await authors(page, id)).toEqual(expected)
  })
}
test('author limits, expanded rows and duplicate names retain their identity', async ({ page }) => {
  const id = await start(page)
  const dialog = page.getByRole('dialog', { name: 'Add reference', exact: true })
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Add author', exact: true })).toBeFocused()
  await replaceAuthors(dialog, ['Duplicate', 'Duplicate'])
  await addAuthor(dialog, `${'A'.repeat(201)}\nSecond`)
  const authorEditor = page.getByRole('dialog', { name: 'Add author', exact: true })
  await expect(authorEditor.getByRole('alert')).toBeVisible()
  await authorEditor.getByLabel('Author name', { exact: true }).fill('Second')
  await expect(authorEditor.getByLabel('Author name', { exact: true })).toBeFocused()
  await authorEditor.getByRole('button', { name: 'Save', exact: true }).click()
  const more = Array.from({ length: 48 }, (_, index) => `Name ${index}`)
  await addAuthor(dialog, more.join('\n'))
  await expect(authorEditor.getByRole('alert')).toBeVisible()
  expect(await authors(page, id)).toEqual([])
  await authorEditor.getByLabel('Author name', { exact: true }).fill(more.slice(0, 47).join('\n'))
  await authorEditor.getByRole('button', { name: 'Save', exact: true }).click()
  await dialog.getByRole('button', { name: 'Show fewer authors', exact: true }).click()
  await expect(dialog.locator('[data-author-name]')).toHaveCount(5)
  await dialog.getByRole('button', { name: 'Show all 50 authors', exact: true }).click()
  await expect(dialog.locator('[data-author-name]')).toHaveCount(50)
  await editAuthor(dialog, 2, 'Edited duplicate')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(async () => (await authors(page, id))[1], { timeout: 15000 }).toBe('Edited duplicate')
  expect((await authors(page, id))[0]).toBe('Duplicate')
})
