import { expect, test } from '@playwright/test'
import { openDocumentSchema } from '../../src/content/contracts'
import { emptyDocument } from '../../src/content/document'
import { saved, settingsTab, writeDocument } from './helpers'
import { expectAuthors } from './reference-author-helpers'
import { tableDocument } from './table-overlay-helpers'

for (const structured of [false, true]) {
  test(`table citation guards update after editing (${structured ? 'structured' : 'array'})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const document = tableDocument()
    const reference = {
      id: crypto.randomUUID(),
      title: 'Cited in a table',
      authors: ['Author'],
      year: null,
      url: '',
      doi: '',
    }
    document.references = [reference]
    const table = document.blocks[0]?.content
    if (table === undefined || Array.isArray(table) || table.rows[0] === undefined) {
      throw new Error('Missing table fixture')
    }
    const citation = [
      { type: 'citation' as const, props: { referenceId: reference.id, locator: '' } },
    ]
    table.rows[0].cells[0] = citation
    if (structured) {
      for (const row of table.rows) {
        row.cells = row.cells.map(cell => ({
          type: 'tableCell',
          props: { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' },
          content: Array.isArray(cell) ? cell : cell.content,
        }))
      }
    }
    const ack = await writeDocument(page, document)
    await settingsTab(page, 'Content')
    await page.getByRole('button', { name: /^References \(/ }).click()
    const remove = page.getByRole('button', { name: 'Remove reference: Cited in a table', exact: true })
    await expect(remove).toBeDisabled()
    const cell = page.getByLabel('Document body', { exact: true }).locator('td').first()
    await cell.locator('p').fill('Replaced citation')
    await expect(remove).toBeEnabled()
    await remove.click()
    await saved(page)
    await page.reload()
    await expect(cell).toContainText('Replaced citation')
    const response = await page.request.get(`/api/admin/documents/${ack.documentId}`)
    const current = openDocumentSchema.parse(await response.json())
    expect(current.document.references).toEqual([])
  })
}

for (const startWidth of [1024, 1366]) {
  test(`reference and author drafts survive resizing from ${startWidth}px`, async ({ page }, info) => {
    await page.setViewportSize({ width: startWidth, height: 900 })
    const ack = await writeDocument(page, emptyDocument())
    await settingsTab(page, 'Content')
    await page.getByRole('button', { name: /^References \(/ }).click()
    await page.getByRole('button', { name: 'Add reference', exact: true }).click()
    const editor = page.getByRole('dialog', { name: 'Add reference', exact: true })
    await editor.getByLabel('Reference title', { exact: true }).fill('A reference kept through rotation')
    await editor.getByRole('button', { name: 'Add author', exact: true }).click()
    const author = page.getByRole('dialog', { name: 'Add author', exact: true })
    await author.getByLabel('Author name', { exact: true }).fill('Author kept through rotation')
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
    await expect(editor.getByLabel('Reference title', { exact: true })).toHaveValue('A reference kept through rotation')
    await expectAuthors(editor, ['Author kept through rotation'])
    await page.setViewportSize({ width: startWidth === 1024 ? 1366 : 320, height: 900 })
    await editor.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    if (startWidth === 1024) {
      await expect(page.locator('.document-settings')).toBeVisible()
    }
    else {
      await expect(page.getByRole('button', { name: 'Document settings', exact: true })).toBeVisible()
    }
    await saved(page)
    const response = await page.request.get(`/api/admin/documents/${ack.documentId}`)
    const current = openDocumentSchema.parse(await response.json())
    expect(current.document.references).toMatchObject([
      {
        title: 'A reference kept through rotation',
        authors: ['Author kept through rotation'],
      },
    ])
  })
}

test('a settings drawer closed by resizing does not reopen on returning to mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await writeDocument(page, emptyDocument())
  await settingsTab(page, 'Content')
  await expect(page.getByRole('dialog', { name: 'Document settings', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.locator('.document-settings')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 900 })
  await expect(page.getByRole('button', { name: 'Document settings', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('publication keeps reference mutations disabled until its response arrives', async ({ page }) => {
  const document = emptyDocument()
  document.meta.title = 'Reference publication'
  document.meta.slug = `reference-publication-${crypto.randomUUID()}`
  document.references = [
    { id: crypto.randomUUID(), title: 'Unused reference', authors: ['Author'], year: null, url: '', doi: '' },
  ]
  await writeDocument(page, document)
  await settingsTab(page, 'Content')
  await page.getByRole('button', { name: /^References \(/ }).click()
  let release = (): void => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/publish', async (route) => {
    await gate
    await route.continue()
  })
  try {
    const requested = page.waitForRequest(request => request.url().endsWith('/publish'))
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await requested
    for (const name of [
      'Add reference',
      'Edit reference: Unused reference',
      'Remove reference: Unused reference',
    ]) {
      await expect(page.getByRole('button', { name, exact: true })).toBeDisabled()
    }
  }
  finally {
    release()
  }
  await expect(page.getByRole('link', { name: 'View live document', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove reference: Unused reference', exact: true })).toBeEnabled()
})
