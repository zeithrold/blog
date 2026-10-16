import type { Locator, Page, TestInfo } from '@playwright/test'
import { openDocumentSchema } from '@/content/contracts'
import { emptyDocument } from '@/content/document'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { writeDocument } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'
import { addAuthor, discardReference, expectAuthors } from './reference-author-helpers'

function referenceFixture(): ReturnType<typeof emptyDocument> {
  const document = emptyDocument()
  document.meta.title = 'Reference management'
  const cited = { id: crypto.randomUUID(), title: 'Attention Is All You Need', authors: [
    'Ashish Vaswani',
  ], year: 2017, url: 'https://arxiv.org/abs/1706.03762', doi: '' }
  document.references = [cited]
  const paragraph = document.blocks[0]
  if (paragraph !== undefined) {
    paragraph.content = [
      { type: 'text', text: 'A citation ', styles: {} },
      { type: 'citation', props: { referenceId: cited.id, locator: 'p. 3' } },
    ]
  }
  return document
}

async function references(page: Page, id: string): Promise<ReturnType<typeof emptyDocument>['references']> {
  const response = await page.request.get(`/api/admin/documents/${id}`)
  expect(response.ok()).toBe(true)
  return openDocumentSchema.parse(await response.json()).document.references
}

async function settled(dialog: Locator): Promise<void> {
  await expect(dialog).toHaveCSS('opacity', '1')
  await dialog.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map(async animation => await animation.finished.catch(() => {})))
  })
}

type Reference = ReturnType<typeof emptyDocument>['references'][number]

async function createReference(page: Page, id: string, list: Locator, original: Reference[]): Promise<Reference> {
  const add = list.getByRole('button', { name: 'Add reference', exact: true })
  await add.click()
  const dialog = page.getByRole('dialog', { name: 'Add reference', exact: true })
  const title = dialog.getByLabel('Reference title', { exact: true })
  await expect(dialog.getByLabel('DOI', { exact: true })).toBeFocused()
  await expect(title).toHaveValue('')
  await expectAuthors(dialog, [])
  await title.fill('Discarded draft')
  await discardReference(dialog)
  await expect(dialog).toHaveCount(0)
  await expect(add).toBeFocused()
  expect(await references(page, id)).toEqual(original)
  await add.click()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(title).toBeFocused()
  await expect(dialog.getByRole('alert')).toHaveCount(2)
  await title.fill(' A Treatise on Reference Management ')
  await addAuthor(dialog, ' Ada Lovelace\n\n Grace Hopper ')
  await dialog.getByLabel('Year', { exact: true }).fill('2026.5')
  await dialog.getByLabel('DOI', { exact: true }).fill('invalid')
  await dialog.getByLabel('URL', { exact: true }).fill('javascript:alert(1)')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(3)
  expect(await references(page, id)).toEqual(original)
  await dialog.getByLabel('Year', { exact: true }).fill('2026')
  await dialog.getByLabel('DOI', { exact: true }).fill('10.1000/example')
  await dialog.getByLabel('URL', { exact: true }).fill('https://example.com/paper')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(add).toBeFocused()
  await expect.poll(async () => (await references(page, id)).length, { timeout: 15000 }).toBe(2)
  const created = (await references(page, id))[1]
  expect(created).toMatchObject({ title: 'A Treatise on Reference Management', authors: [
    'Ada Lovelace',
    'Grace Hopper',
  ], year: 2026, doi: '10.1000/example', url: 'https://example.com/paper' })
  if (created === undefined) {
    throw new Error('Missing saved reference')
  }
  return created
}

async function editReference(page: Page, id: string, list: Locator, created: Reference): Promise<Locator> {
  const edit = list.getByRole('button', { name: 'Edit reference: A Treatise on Reference Management', exact: true })
  await edit.click()
  const editor = page.getByRole('dialog', { name: 'Edit reference', exact: true })
  await expect(editor.getByLabel('Reference title', { exact: true })).toBeFocused()
  await editor.getByLabel('Reference title', { exact: true }).fill('Cancelled edit')
  await page.keyboard.press('Escape')
  await editor.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await expect(edit).toBeFocused()
  expect((await references(page, id))[1]).toEqual(created)
  await edit.click()
  await editor.getByLabel('Reference title', { exact: true }).fill('A Practical Guide to Reference Management')
  return editor
}

async function dialogLayout(editor: Locator, page: Page, info: TestInfo, width: number): Promise<void> {
  await settled(editor)
  const box = await editor.boundingBox()
  if (box === null) {
    throw new Error('Missing reference dialog bounds')
  }
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(width)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(740)
  const year = await editor.getByLabel('Year', { exact: true }).boundingBox()
  const doi = await editor.getByLabel('DOI', { exact: true }).boundingBox()
  if (year === null || doi === null) {
    throw new Error('Missing field bounds')
  }
  if (width > 600) {
    const url = await editor.getByLabel('URL', { exact: true }).boundingBox()
    expect(Math.abs(year.y - (url?.y ?? 0))).toBeLessThanOrEqual(1)
  }
  else {
    expect(year.y).toBeGreaterThan(doi.y)
  }
  await assertAccessible(page, info, { label: `reference-dialog-${width}` })
  await page.screenshot({ path: info.outputPath(`reference-dialog-${width}.png`) })
}

for (const width of [
  320,
  390,
  1440,
]) {
  test(`reference drafts save explicitly and keep cited records intact at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 740 })
    const fixtureDocument = referenceFixture()
    const ack = await writeDocument(page, fixtureDocument)
    await settingsTab(page, 'Content')
    const list = page.locator('.reference-settings')
    await list.getByRole('button', { name: /^References \(/ }).click()
    await expect(list.locator('input, textarea')).toHaveCount(0)
    await expect(list.getByRole('button', { name: 'Remove reference: Attention Is All You Need', exact: true }))
      .toBeDisabled()
    await expect(list).toContainText('Remove citations from the body before removing this reference.')
    const created = await createReference(page, ack.documentId, list, fixtureDocument.references)
    const editor = await editReference(page, ack.documentId, list, created)
    await dialogLayout(editor, page, info, width)
    await editor.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(async () => (await references(page, ack.documentId))[1]?.title, { timeout: 15000 })
      .toBe('A Practical Guide to Reference Management')
    const edited = (await references(page, ack.documentId))[1]
    expect(edited?.id).toBe(created.id)
    expect(edited?.title).toBe('A Practical Guide to Reference Management')
    await expect(list.locator('.reference-item')).toHaveCount(2)
    await expect(list.locator('input, textarea')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`reference-list-${width}.png`) })
    const remove = list.getByRole('button', {
      name: 'Remove reference: A Practical Guide to Reference Management',
      exact: true,
    })
    await remove.click()
    await expect.poll(async () => await references(page, ack.documentId), { timeout: 15000 })
      .toEqual(fixtureDocument.references)
    expect(await references(page, ack.documentId)).toEqual(fixtureDocument.references)
    await page.reload()
    await expect(page.getByLabel('Document body', { exact: true })).toContainText('A citation')
    expect(await references(page, ack.documentId)).toEqual(fixtureDocument.references)
  })
}
