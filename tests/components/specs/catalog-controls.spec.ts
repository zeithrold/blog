import { catalogEntry, catalogPage } from '~/tests/components/support/domain-fixtures'
import { catalogCopy } from '~/tests/components/support/expected-copy'
import { serveApi } from '~/tests/components/support/http-fixtures'
import { mountSurface } from '~/tests/components/support/mount'
import { expect, test } from '~/tests/components/support/test'

// The search box is list state, not a request: it filters the rows the surface
// already has, and it must leave the form the operator is editing untouched.
// This proof does not claim real application routing or persistence.
test('Search catalog filters by name and slug without touching the edited draft', async ({ page }) => {
  const copy = catalogCopy.en
  const notes = catalogEntry({ kind: 'tag', name: 'Craft Notes', slug: 'craft-notes' })
  const building = catalogEntry({ kind: 'tag', name: 'Building', slug: 'building-guide' })
  const garden = catalogEntry({ kind: 'tag', name: 'Garden', slug: 'plot-42' })
  const api = await serveApi(page, {
    'GET /api/admin/catalog/tag': () => ({ body: catalogPage([
      notes,
      building,
      garden,
    ]) }),
  })
  try {
    await mountSurface(page, { surface: 'catalog-tag' })
    const mounted = page.url()
    const search = page.getByRole('searchbox', { name: copy.search, exact: true })
    const edit = (name: string): ReturnType<typeof page.getByRole> =>
      page.getByRole('button', { name: `${copy.edit} ${name}`, exact: true })
    await expect(edit(notes.name)).toBeVisible()
    await expect(edit(building.name)).toBeVisible()
    await expect(edit(garden.name)).toBeVisible()

    // A lower-case query still matches a capitalised name...
    await search.fill('craft notes')
    await expect(edit(notes.name)).toBeVisible()
    await expect(edit(building.name)).toHaveCount(0)
    await expect(edit(garden.name)).toHaveCount(0)

    // ...and an upper-case query matches the slug that contains it.
    await search.fill('PLOT')
    await expect(edit(garden.name)).toBeVisible()
    await expect(edit(notes.name)).toHaveCount(0)
    await expect(edit(building.name)).toHaveCount(0)

    // Clearing restores every served row.
    await search.fill('')
    await expect(edit(notes.name)).toBeVisible()
    await expect(edit(building.name)).toBeVisible()
    await expect(edit(garden.name)).toBeVisible()

    // Filtering never moves the surface or discards the draft being edited.
    await edit(notes.name).click()
    await page.getByLabel(copy.name, { exact: true }).fill('Draft kept during search')
    await search.fill('garden')
    await expect(edit(garden.name)).toBeVisible()
    await expect(edit(notes.name)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: copy.editTag, exact: true })).toBeVisible()
    await expect(page.getByLabel(copy.name, { exact: true })).toHaveValue('Draft kept during search')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await search.fill('')
    await expect(edit(notes.name)).toBeVisible()
    await expect(page.getByLabel(copy.name, { exact: true })).toHaveValue('Draft kept during search')
    expect(page.url()).toBe(mounted)
    // Only the initial read: typing and clearing never reach the server.
    expect(api.calls).toHaveLength(1)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})

// "New series" is a real button on the series surface: it either discards a dirty
// draft after confirmation or resets the form to a real create form.
test('New series discards a dirty form only after confirmation and resets it', async ({ page }) => {
  const copy = catalogCopy.en
  const existing = catalogEntry({ kind: 'series', name: 'Building', slug: 'building' })
  const api = await serveApi(page, {
    'GET /api/admin/catalog/series': () => ({ body: catalogPage([existing]) }),
  })
  try {
    await mountSurface(page, { surface: 'catalog-series' })
    const mounted = page.url()
    const name = page.getByLabel(copy.name, { exact: true })
    const create = page.getByRole('button', { name: copy.newSeries, exact: true })
    const heading = (title: string): ReturnType<typeof page.getByRole> =>
      page.getByRole('heading', { name: title, exact: true })
    await page.getByRole('button', { name: `${copy.edit} ${existing.name}`, exact: true }).click()
    await expect(heading(copy.editSeries)).toBeVisible()
    await name.fill('Local series draft')

    // A dirty form asks before it throws the draft away; cancel keeps everything.
    await create.click()
    const dialog = page.getByRole('dialog', { name: copy.discard, exact: true })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: copy.cancel, exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(create).toBeFocused()
    await expect(heading(copy.editSeries)).toBeVisible()
    await expect(name).toHaveValue('Local series draft')

    // Confirming resets to a create form and focuses its first field.
    await create.click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: copy.confirm, exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(heading(copy.newSeries)).toBeVisible()
    await expect(name).toHaveValue('')
    await expect(page.getByLabel(copy.slug, { exact: true })).toHaveValue('')
    await expect(page.getByLabel(copy.retired, { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: copy.save, exact: true })).toBeDisabled()
    await expect(name).toBeFocused()
    expect(page.url()).toBe(mounted)
    // Neither branch wrote: only the initial read happened.
    expect(api.calls.filter(call => call.method !== 'GET')).toHaveLength(0)
    await api.expectServed()
  }
  finally {
    await api.dispose()
  }
})
