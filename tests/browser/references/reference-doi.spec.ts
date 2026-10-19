import type { Locator, Page } from '@playwright/test'
import { emptyDocument } from '@/content/document'
import { openDocumentSchema } from '@/contracts/documents'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { writeDocument } from '~/tests/support/browser/document'
import { settingsTab } from '~/tests/support/browser/settings'
import { expect, test } from '~/tests/support/browser/test'
import { discardReference, expectAuthors, replaceAuthors } from './reference-author-helpers'

const metadata = { doi: '10.1234/example', title: 'A Retrieved Research Paper', authors: [
  'Ada Lovelace',
  'Grace Hopper',
], year: 2026, url: 'https://doi.org/10.1234/example', source: 'Crossref' }

async function openReference(page: Page): Promise<string> {
  const document = emptyDocument()
  document.meta.title = 'DOI reference import'
  const ack = await writeDocument(page, document)
  await settingsTab(page, 'Content')
  await page.getByRole('button', { name: /^References \(/ }).click()
  await page.getByRole('button', { name: 'Add reference', exact: true }).click()
  return ack.documentId
}
async function references(page: Page, id: string): Promise<ReturnType<typeof emptyDocument>['references']> {
  const response = await page.request.get(`/api/admin/documents/${id}`)
  expect(response.ok()).toBe(true)
  return openDocumentSchema.parse(await response.json()).document.references
}

for (const width of [
  320,
  390,
  1440,
]) {
  test(`DOI lookup preserves manual entries and saves explicitly at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 740 })
    await page.route('**/api/admin/reference-metadata?*', async (route) => {
      expect(new URL(route.request().url()).searchParams.get('doi')).toBe(metadata.doi)
      await route.fulfill({ json: metadata })
    })
    const id = await openReference(page)
    const dialog = page.getByRole('dialog', { name: 'Add reference', exact: true })
    const doi = dialog.getByLabel('DOI', { exact: true })
    await expect(doi).toBeFocused()
    await doi.fill(`https://doi.org/${metadata.doi}`)
    await doi.press('Enter')
    await expect(lookupStatus(dialog)).toContainText('Information retrieved')
    await expect(doi).toHaveValue(metadata.doi)
    await expect(dialog.getByLabel('Reference title', { exact: true })).toHaveValue(metadata.title)
    await expectAuthors(dialog, metadata.authors)
    await expect(dialog.getByLabel('Year', { exact: true })).toHaveValue('2026')
    await expect(dialog.getByLabel('URL', { exact: true })).toHaveValue(metadata.url)
    expect(await references(page, id)).toEqual([])
    await dialog.getByLabel('Reference title', { exact: true }).fill('My curated title')
    await replaceAuthors(dialog, ['My author'])
    await dialog.getByLabel('URL', { exact: true }).fill('https://example.com/my-link')
    await dialog.getByRole('button', { name: 'Get information', exact: true }).click()
    await expect(lookupStatus(dialog)).toContainText('Information retrieved')
    await expect(dialog.getByLabel('Reference title', { exact: true })).toHaveValue('My curated title')
    await expectAuthors(dialog, ['My author'])
    await expect(dialog.getByLabel('URL', { exact: true })).toHaveValue('https://example.com/my-link')
    const footer = dialog.locator('[data-slot="dialog-footer"]')
    await expect(footer.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
    await dialog.locator('form > div').first().evaluate(element => element.scrollTo({ top: 0 }))
    await assertAccessible(page, info, { label: `doi-reference-${width}` })
    await page.screenshot({ path: info.outputPath(`doi-reference-${width}.png`) })
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect.poll(async () => (await references(page, id)).length, { timeout: 15000 }).toBe(1)
    expect((await references(page, id))[0]).toMatchObject({ title: 'My curated title', authors: [
      'My author',
    ], year: 2026, doi: metadata.doi, url: 'https://example.com/my-link' })
    await page.reload()
    expect((await references(page, id))[0]?.doi).toBe(metadata.doi)
  })
}

test('failed and partial DOI lookups leave manual creation available', async ({ page }) => {
  let requests = 0
  await page.route('**/api/admin/reference-metadata?*', async (route) => {
    requests++
    if (requests === 1) {
      await route.fulfill({ status: 404, json: { code: 'DOI_NOT_FOUND' } })
    }
    else {
      await route.fulfill({ json: { ...metadata, title: '', authors: [], year: null } })
    }
  })
  const id = await openReference(page)
  const dialog = page.getByRole('dialog', { name: 'Add reference', exact: true })
  const doi = dialog.getByLabel('DOI', { exact: true })
  await doi.fill('invalid')
  await dialog.getByRole('button', { name: 'Get information', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Enter a DOI')
  expect(requests).toBe(0)
  await doi.fill(metadata.doi)
  await dialog.getByRole('button', { name: 'Get information', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('No information was found')
  await dialog.getByRole('button', { name: 'Get information', exact: true }).click()
  await expect(lookupStatus(dialog)).toContainText('Some information is missing')
  await expect(dialog.getByLabel('Reference title', { exact: true })).toHaveValue('')
  await dialog.getByLabel('Reference title', { exact: true }).fill('Manual title')
  await replaceAuthors(dialog, ['Manual author'])
  await discardReference(dialog)
  await expect(dialog).toHaveCount(0)
  expect(await references(page, id)).toEqual([])
})

test('changing DOI and closing the dialog prevents delayed metadata from altering a new draft', async ({ page }) => {
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/admin/reference-metadata?*', async (route) => {
    await gate
    await route.fulfill({ json: metadata }).catch(() => {})
  })
  const id = await openReference(page)
  const dialog = page.getByRole('dialog', { name: 'Add reference', exact: true })
  await dialog.getByLabel('DOI', { exact: true }).fill(metadata.doi)
  await dialog.getByRole('button', { name: 'Get information', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Retrieving…', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await dialog.getByLabel('Reference title', { exact: true }).fill('Written during lookup')
  await dialog.getByLabel('DOI', { exact: true }).fill('10.1234/new')
  release()
  await expect(dialog.getByLabel('Reference title', { exact: true })).toHaveValue('Written during lookup')
  await expectAuthors(dialog, [])
  await discardReference(dialog)
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: 'Add reference', exact: true }).click()
  await expect(dialog.getByLabel('DOI', { exact: true })).toHaveValue('')
  await expect(dialog.getByLabel('Reference title', { exact: true })).toHaveValue('')
  expect(await references(page, id)).toEqual([])
})

test('DOI lookup keeps an author typed while the request is pending', async ({ page }) => {
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/admin/reference-metadata?*', async (route) => {
    await gate
    await route.fulfill({ json: metadata })
  })
  const id = await openReference(page)
  const dialog = page.getByRole('dialog', { name: 'Add reference', exact: true })
  await dialog.getByLabel('DOI', { exact: true }).fill(metadata.doi)
  await dialog.getByRole('button', { name: 'Get information', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await replaceAuthors(dialog, ['Manually typed author'])
  release()
  await expect(lookupStatus(dialog)).toContainText('Information retrieved')
  await expectAuthors(dialog, ['Manually typed author'])
  await expect(dialog.locator('[data-author-name]')).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(async () => (await references(page, id))[0]?.authors, { timeout: 15000 })
    .toEqual(['Manually typed author'])
})

function lookupStatus(dialog: Locator): Locator {
  return dialog.getByRole('status').filter({ hasText: /Information retrieved|Some information/u })
}
