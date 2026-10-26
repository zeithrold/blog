import { catalogEntry, catalogPage } from '~/tests/components/support/domain-fixtures'
import { catalogCopy } from '~/tests/components/support/expected-copy'
import { serveApi } from '~/tests/components/support/http-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'

// The search box is list state, not a request: it filters the rows the surface
// already has, and it must leave the form the operator is editing untouched.
// This proof does not claim real application routing or persistence.
// "New series" is a real button on the series surface: it either discards a dirty
// draft after confirmation or resets the form to a real create form.
test('New series discard dialog returns native focus after cancel and confirm', async ({ page }) => {
  const copy = catalogCopy.en
  const existing = catalogEntry({ kind: 'series', name: 'Building', slug: 'building' })
  const api = await serveApi(page, {
    'GET /api/admin/catalog/series': () => ({ body: catalogPage([existing]) }),
  })
  try {
    await mountSurface(page, { surface: 'catalog-series' })
    const name = page.getByLabel(copy.name, { exact: true })
    const create = page.getByRole('button', { name: copy.newSeries, exact: true })
    await page.getByRole('button', { name: `${copy.edit} ${existing.name}`, exact: true }).click()
    await name.fill('Local series draft')

    // Cancel must return native focus to the New series control.
    await create.click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: copy.cancel, exact: true }).click()
    await expect(create).toBeFocused()

    // Confirm must focus the first field after the dialog closes.
    await create.click()
    await dialog.getByRole('button', { name: copy.confirm, exact: true }).click()
    await expect(name).toBeFocused()
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
