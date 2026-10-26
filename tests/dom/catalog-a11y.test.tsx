import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { catalogEntry, catalogPage } from '~/tests/components/support/domain-fixtures'
import { catalogCopy } from '~/tests/components/support/expected-copy'
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

it('Chinese dark catalog editing keeps the draft when cancellation closes the dialog', async () => {
  const unique = crypto.randomUUID()
  const first = catalogEntry({ kind: 'tag', name: `保留 A ${unique}`, slug: `keep-a-${unique}` })
  const second = catalogEntry({ kind: 'tag', name: `保留 B ${unique}`, slug: `keep-b-${unique}` })
  const local = '保留这份未保存修改'
  const view = mountCatalog({
    kind: 'tag',
    handlers: {
      'GET /api/admin/catalog/tag': () => ({ body: catalogPage([first, second]) }),
    },
    locale: 'zh',
    mode: 'dark',
    width: 320,
  })
  await settleCatalog(view)
  const copy = catalogCopy.zh
  expect(view.container.querySelector('h1')?.textContent).toBe(copy.tags)
  act(() => {
    click(editButton(view.container, `${copy.edit} ${first.name}`))
  })
  typeText(textInput(view.container, copy.name), local)
  act(() => {
    click(editButton(view.container, `${copy.edit} ${second.name}`))
  })
  await until(() => document.querySelector('[role="dialog"]') !== null)
  const dialog = one(document, '[role="dialog"]')
  expect(dialog.textContent).toContain(copy.discard)
  expect(dialog.textContent).toContain(copy.review)
  expect(textInput(view.container, copy.name).value).toBe(local)

  act(() => {
    click(button(dialog, copy.cancel))
  })
  await until(() => document.querySelector('[role="dialog"]') === null)
  expect(textInput(view.container, copy.name).value).toBe(local)
  expect(view.api.calls).toHaveLength(1)
})
