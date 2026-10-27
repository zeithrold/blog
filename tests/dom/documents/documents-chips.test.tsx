import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { documentsCopy } from '~/tests/dom/shared/copy'
import { documentEntry, documentsPage } from '~/tests/dom/shared/fixtures'
import {
  button,
  click,
  mountDocuments,
  one,
  resetDocumentsDom,
  settleDocuments,
  textInput,
  typeText,
} from './documents-support'

afterEach(resetDocumentsDom)

async function searchChip(locale: 'en' | 'zh', query: string): Promise<void> {
  const entry = documentEntry({ title: 'Search chip row' })
  const view = mountDocuments({
    handlers: {
      // This route answers explicitly with the same listed page for each submitted query.
      'GET /api/admin/documents': () => ({ body: documentsPage([entry]) }),
    },
    locale,
    width: 320,
  })
  await settleDocuments(view)
  const copy = documentsCopy[locale]
  const search = textInput(view.container, copy.search)
  typeText(search, query)
  expect(search.value).toBe(query)
  act(() => {
    click(button(view.container, copy.submit))
  })
  await settleDocuments(view)
  const active = one<HTMLUListElement>(view.container, `[aria-label="${copy.activeFilters}"]`)
  const chip = one<HTMLButtonElement>(active, 'button')
  expect(chip.getAttribute('aria-label')).toBe(`${copy.removeFilter}: ${copy.search}: ${query}`)

  act(() => {
    click(chip)
  })
  await settleDocuments(view)
  expect(view.container.querySelector(`[aria-label="${copy.activeFilters}"]`)).toBeNull()
  expect(search.value).toBe('')
  expect(view.api.calls).toHaveLength(3)
}

it('120-character en search chip is named and removable', async () => {
  await searchChip('en', 'W'.repeat(120))
})

it('120-character zh search chip is named and removable', async () => {
  await searchChip('zh', '文'.repeat(120))
})
