import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { catalogCopy } from '~/tests/dom/shared/copy'
import { catalogEntry, catalogPage } from '~/tests/dom/shared/fixtures'
import {
  button,
  click,
  editButton,
  mountCatalog,
  one,
  resetCatalogDom,
  settleCatalog,
  textInput,
  typeText,
  until,
} from './catalog-support'

afterEach(resetCatalogDom)

it('Search catalog filters by name and slug without touching the edited draft', async () => {
  const copy = catalogCopy.en
  const notes = catalogEntry({ kind: 'tag', name: 'Craft Notes', slug: 'craft-notes' })
  const building = catalogEntry({ kind: 'tag', name: 'Building', slug: 'building-guide' })
  const garden = catalogEntry({ kind: 'tag', name: 'Garden', slug: 'plot-42' })
  const view = mountCatalog({
    kind: 'tag',
    handlers: {
      'GET /api/admin/catalog/tag': () => ({
        body: catalogPage([
          notes,
          building,
          garden,
        ]),
      }),
    },
  })
  await settleCatalog(view)
  const search = textInput(view.container, copy.search)
  expect(editButton(view.container, `${copy.edit} ${notes.name}`).isConnected).toBe(true)
  expect(editButton(view.container, `${copy.edit} ${building.name}`).isConnected).toBe(true)
  expect(editButton(view.container, `${copy.edit} ${garden.name}`).isConnected).toBe(true)

  typeText(search, 'craft notes')
  expect(editButton(view.container, `${copy.edit} ${notes.name}`).isConnected).toBe(true)
  expect(view.container.querySelector(`button[aria-label="${copy.edit} ${building.name}"]`)).toBeNull()
  expect(view.container.querySelector(`button[aria-label="${copy.edit} ${garden.name}"]`)).toBeNull()

  typeText(search, 'PLOT')
  expect(editButton(view.container, `${copy.edit} ${garden.name}`).isConnected).toBe(true)
  expect(view.container.querySelector(`button[aria-label="${copy.edit} ${notes.name}"]`)).toBeNull()
  expect(view.container.querySelector(`button[aria-label="${copy.edit} ${building.name}"]`)).toBeNull()

  typeText(search, '')
  expect(editButton(view.container, `${copy.edit} ${notes.name}`).isConnected).toBe(true)
  expect(editButton(view.container, `${copy.edit} ${building.name}`).isConnected).toBe(true)
  expect(editButton(view.container, `${copy.edit} ${garden.name}`).isConnected).toBe(true)

  act(() => {
    click(editButton(view.container, `${copy.edit} ${notes.name}`))
  })
  typeText(textInput(view.container, copy.name), 'Draft kept during search')
  typeText(search, 'garden')
  expect(editButton(view.container, `${copy.edit} ${garden.name}`).isConnected).toBe(true)
  expect(view.container.querySelector(`button[aria-label="${copy.edit} ${notes.name}"]`)).toBeNull()
  expect(view.container.querySelector('h2')?.textContent).toBe(copy.editTag)
  expect(textInput(view.container, copy.name).value).toBe('Draft kept during search')
  expect(document.querySelector('[role="dialog"]')).toBeNull()

  typeText(search, '')
  expect(editButton(view.container, `${copy.edit} ${notes.name}`).isConnected).toBe(true)
  expect(textInput(view.container, copy.name).value).toBe('Draft kept during search')
  expect(view.api.calls).toHaveLength(1)
})

it('New series discards a dirty form only after confirmation and resets it', async () => {
  const copy = catalogCopy.en
  const existing = catalogEntry({ kind: 'series', name: 'Building', slug: 'building' })
  const view = mountCatalog({
    kind: 'series',
    handlers: {
      'GET /api/admin/catalog/series': () => ({ body: catalogPage([existing]) }),
    },
  })
  await settleCatalog(view)
  const name = textInput(view.container, copy.name)
  const create = button(view.container, copy.newSeries)
  act(() => {
    click(editButton(view.container, `${copy.edit} ${existing.name}`))
  })
  expect(view.container.querySelector('h2')?.textContent).toBe(copy.editSeries)
  typeText(name, 'Local series draft')

  act(() => {
    click(create)
  })
  await until(() => document.querySelector('[role="dialog"]') !== null)
  const dialog = one(document, '[role="dialog"]')
  expect(dialog.textContent).toContain(copy.discard)
  expect(dialog.textContent).toContain(copy.review)
  act(() => {
    click(button(dialog, copy.cancel))
  })
  await until(() => document.querySelector('[role="dialog"]') === null)
  expect(view.container.querySelector('h2')?.textContent).toBe(copy.editSeries)
  expect(name.value).toBe('Local series draft')

  act(() => {
    click(create)
  })
  await until(() => document.querySelector('[role="dialog"]') !== null)
  const confirmation = one(document, '[role="dialog"]')
  act(() => {
    click(button(confirmation, copy.confirm))
  })
  await until(() => document.querySelector('[role="dialog"]') === null)
  expect(view.container.querySelector('h2')?.textContent).toBe(copy.newSeries)
  expect(name.value).toBe('')
  expect(textInput(view.container, copy.slug).value).toBe('')
  expect(view.container.querySelector('[role="checkbox"]')).toBeNull()
  expect(button(view.container, copy.save).disabled).toBe(true)
  expect(view.api.calls.filter(call => call.method !== 'GET')).toHaveLength(0)
})
