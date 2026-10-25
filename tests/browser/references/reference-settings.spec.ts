import type { Page } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { openDocumentSchema } from '@/contracts/documents'
import { writeDocument } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'
import { addAuthor } from './reference-author-helpers'

/**
 * The stored roundtrip a reference draft takes through the real application:
 * create, edit and remove a reference, reading the document back from the
 * Worker after each save and again after a reload.
 *
 * The form itself (its fields, error labels, geometry and the drawer page that
 * holds it) is proved on the component surface in
 * `tests/components/specs/references-form.spec.ts`. What stays here needs
 * the routed app and its database: the stored copy, the cited guard that reads
 * the body, and the document that survives a reload.
 */

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

for (const width of [390, 1440]) {
  test(`reference drafts save and keep cited records intact at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 })
    const document = referenceFixture()
    const ack = await writeDocument(page, document)
    await settingsTab(page, 'Content')
    const list = page.locator('.reference-settings')
    await list.getByRole('button', { name: /^References \(/ }).click()
    const add = list.getByRole('button', { name: 'Add reference', exact: true })
    await add.click()
    const dialog = page.getByRole('dialog', { name: 'Add reference', exact: true })
    await dialog.getByLabel('Reference title', { exact: true }).fill(' A Treatise on Reference Management ')
    await addAuthor(dialog, ' Ada Lovelace\n\n Grace Hopper ')
    await dialog.getByLabel('Year', { exact: true }).fill('2026')
    await dialog.getByLabel('DOI', { exact: true }).fill('10.1000/example')
    await dialog.getByLabel('URL', { exact: true }).fill('https://example.com/paper')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(add).toBeFocused()
    await expect.poll(async () => (await references(page, ack.documentId)).length, { timeout: 15000 }).toBe(2)
    const created = (await references(page, ack.documentId))[1]
    expect(created).toMatchObject({ title: 'A Treatise on Reference Management', authors: [
      'Ada Lovelace',
      'Grace Hopper',
    ], year: 2026, doi: '10.1000/example', url: 'https://example.com/paper' })
    if (created === undefined) {
      throw new Error('Missing saved reference')
    }
    const edit = list.getByRole('button', { name: 'Edit reference: A Treatise on Reference Management', exact: true })
    await edit.click()
    const editor = page.getByRole('dialog', { name: 'Edit reference', exact: true })
    await editor.getByLabel('Reference title', { exact: true }).fill('A Practical Guide to Reference Management')
    await editor.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(async () => (await references(page, ack.documentId))[1]?.title, { timeout: 15000 })
      .toBe('A Practical Guide to Reference Management')
    const edited = (await references(page, ack.documentId))[1]
    expect(edited?.id).toBe(created.id)
    expect(edited?.title).toBe('A Practical Guide to Reference Management')
    const remove = list.getByRole('button', {
      name: 'Remove reference: A Practical Guide to Reference Management',
      exact: true,
    })
    await remove.click()
    await expect.poll(async () => await references(page, ack.documentId), { timeout: 15000 })
      .toEqual(document.references)
    expect(await references(page, ack.documentId)).toEqual(document.references)
    await page.reload()
    await expect(page.getByLabel('Document body', { exact: true })).toContainText('A citation')
    expect(await references(page, ack.documentId)).toEqual(document.references)
  })
}
