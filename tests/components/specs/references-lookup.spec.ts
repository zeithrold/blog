import {
  discardReference,
  expectAuthors,
  replaceAuthors,
} from '~/tests/browser/references/reference-author-helpers'
import { assertAccessible } from '~/tests/support/browser/accessibility'
import { editorWorkspaceDocument } from '../support/editor-workspace-fixtures'
import { mountEditorWorkspace } from '../support/editor-workspace-ui'
import { defer, failure } from '../support/http-fixtures'
import {
  attemptedWrites,
  partialReferenceMetadata,
  referenceMetadata,
  referenceSaveRoute,
  writtenLists,
} from '../support/reference-fixtures'
import { addReference, lookupStatus, openReferenceList } from '../support/reference-ui'
import { expect, test } from '../support/test'

/**
 * The DOI lookup fills the fields a case left empty and never replaces a newer
 * draft, in either direction: a lookup that lands late, or an author typed while
 * one is still in flight.
 *
 * The lookup answers come from this case's handler table, so the request is the
 * one the form sent; `GET /api/admin/reference-metadata` itself is proved by the
 * Worker integration cases.
 */

for (const width of [
  320,
  390,
  1440,
]) {
  test(`DOI lookup fills empty fields and keeps a curated draft at ${width}px`, async ({ page }, info) => {
    const lookedUp: string[] = []
    const api = await mountEditorWorkspace(page, {
      document: editorWorkspaceDocument('DOI reference import'),
      width,
      writes: {
        ...referenceSaveRoute,
        'GET /api/admin/reference-metadata': (call) => {
          lookedUp.push(call.query.get('doi') ?? '')
          return { body: referenceMetadata }
        },
      },
    })
    try {
      const list = await openReferenceList(page)
      const dialog = await addReference(page, list)
      const doi = dialog.getByLabel('DOI', { exact: true })
      const title = dialog.getByLabel('Reference title', { exact: true })
      await expect(doi).toBeFocused()
      await doi.fill(`https://doi.org/${referenceMetadata.doi}`)
      await doi.press('Enter')
      await expect(lookupStatus(dialog)).toContainText('Information retrieved')
      await expect(doi).toHaveValue(referenceMetadata.doi)
      await expect(title).toHaveValue(referenceMetadata.title)
      await expectAuthors(dialog, referenceMetadata.authors)
      await expect(dialog.getByLabel('Year', { exact: true })).toHaveValue('2026')
      await expect(dialog.getByLabel('URL', { exact: true })).toHaveValue(referenceMetadata.url)
      expect(attemptedWrites(api)).toEqual([])
      // A second lookup keeps the entries the author curated by hand.
      await title.fill('My curated title')
      await replaceAuthors(dialog, ['My author'])
      await dialog.getByLabel('URL', { exact: true }).fill('https://example.com/my-link')
      await dialog.getByRole('button', { name: 'Get information', exact: true }).click()
      await expect(lookupStatus(dialog)).toContainText('Information retrieved')
      await expect(title).toHaveValue('My curated title')
      await expectAuthors(dialog, ['My author'])
      await expect(dialog.getByLabel('URL', { exact: true })).toHaveValue('https://example.com/my-link')
      expect(lookedUp).toEqual(
        [referenceMetadata.doi, referenceMetadata.doi],
      )
      const footer = dialog.locator('[data-slot="dialog-footer"]')
      await expect(footer.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
      await dialog.locator('form > div').first().evaluate(element => element.scrollTo({ top: 0 }))
      await assertAccessible(page, info, { label: `doi-reference-${width}` })
      await page.screenshot({ path: info.outputPath(`doi-reference-${width}.png`) })
      await dialog.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect.poll(() => writtenLists(api.calls).length).toBe(1)
      expect(writtenLists(api.calls)[0]?.[0]).toMatchObject({
        title: 'My curated title',
        authors: ['My author'],
        year: 2026,
        doi: referenceMetadata.doi,
        url: 'https://example.com/my-link',
      })
      await api.expectServed()
    }
    finally {
      await api.dispose()
    }
  })
}

test('failed and partial DOI lookups leave manual creation available', async ({ page }) => {
  let requests = 0
  const api = await mountEditorWorkspace(page, {
    document: editorWorkspaceDocument('DOI lookup failures'),
    writes: {
      'GET /api/admin/reference-metadata': () => {
        requests += 1
        return requests === 1
          ? failure(404, 'DOI_NOT_FOUND')
          : { body: partialReferenceMetadata }
      },
    },
  })
  try {
    const list = await openReferenceList(page)
    const dialog = await addReference(page, list)
    const doi = dialog.getByLabel('DOI', { exact: true })
    // A DOI that cannot be parsed is reported without a request.
    await doi.fill('invalid')
    await dialog.getByRole('button', { name: 'Get information', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Enter a DOI')
    expect(requests).toBe(0)
    await doi.fill(referenceMetadata.doi)
    await dialog.getByRole('button', { name: 'Get information', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('No information was found')
    await dialog.getByRole('button', { name: 'Get information', exact: true }).click()
    await expect(lookupStatus(dialog)).toContainText('Some information is missing')
    await expect(dialog.getByLabel('Reference title', { exact: true })).toHaveValue('')
    await dialog.getByLabel('Reference title', { exact: true }).fill('Manual title')
    await replaceAuthors(dialog, ['Manual author'])
    await discardReference(dialog)
    await expect(dialog).toHaveCount(0)
    expect(attemptedWrites(api)).toEqual([])
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

test('changing DOI and closing the dialog prevents delayed metadata from altering a new draft', async ({ page }) => {
  const held = defer()
  const api = await mountEditorWorkspace(page, {
    document: editorWorkspaceDocument('Delayed metadata'),
    writes: {
      'GET /api/admin/reference-metadata': async () => {
        await held.promise
        return { body: referenceMetadata }
      },
    },
  })
  try {
    const list = await openReferenceList(page)
    const dialog = await addReference(page, list)
    const title = dialog.getByLabel('Reference title', { exact: true })
    await dialog.getByLabel('DOI', { exact: true }).fill(referenceMetadata.doi)
    await dialog.getByRole('button', { name: 'Get information', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Retrieving…', exact: true })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await title.fill('Written during lookup')
    await dialog.getByLabel('DOI', { exact: true }).fill('10.1234/new')
    held.open()
    await expect(title).toHaveValue('Written during lookup')
    await expectAuthors(dialog, [])
    await discardReference(dialog)
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: 'Add reference', exact: true }).click()
    await expect(dialog.getByLabel('DOI', { exact: true })).toHaveValue('')
    await expect(title).toHaveValue('')
    expect(attemptedWrites(api)).toEqual([])
    await api.expectServed()
  }
  finally {
    held.open()
    await api.dispose()
  }
})

test('DOI lookup keeps an author typed while the request is pending', async ({ page }) => {
  const held = defer()
  const api = await mountEditorWorkspace(page, {
    document: editorWorkspaceDocument('Pending lookup author'),
    writes: {
      ...referenceSaveRoute,
      'GET /api/admin/reference-metadata': async () => {
        await held.promise
        return { body: referenceMetadata }
      },
    },
  })
  try {
    const list = await openReferenceList(page)
    const dialog = await addReference(page, list)
    await dialog.getByLabel('DOI', { exact: true }).fill(referenceMetadata.doi)
    await dialog.getByRole('button', { name: 'Get information', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await replaceAuthors(dialog, ['Manually typed author'])
    held.open()
    await expect(lookupStatus(dialog)).toContainText('Information retrieved')
    await expectAuthors(dialog, ['Manually typed author'])
    await expect(dialog.locator('[data-author-name]')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect.poll(() => writtenLists(api.calls).length).toBe(1)
    expect(writtenLists(api.calls)[0]?.[0]?.authors).toEqual(['Manually typed author'])
    await api.expectServed()
  }
  finally {
    held.open()
    await api.dispose()
  }
})
