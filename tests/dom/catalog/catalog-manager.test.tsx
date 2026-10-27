/* eslint-disable max-lines -- Eight catalog session cases share their declared HTTP fixture patterns. */
import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { catalogCopy } from '~/tests/dom/shared/copy'
import { catalogEntry, catalogPage } from '~/tests/dom/shared/fixtures'
import { defer, failure, lostResponse } from '~/tests/dom/shared/http'
import {
  button,
  click,
  editButton,
  expectToast,
  mountCatalog,
  resetCatalogDom,
  settleCatalog,
  textInput,
  typeText,
} from './catalog-support'

afterEach(resetCatalogDom)

/* eslint-disable-next-line max-lines-per-function -- This case follows one held tag refresh through its save. */
it('a slow tag refresh cannot retarget a different entry\'s form', async () => {
  const unique = crypto.randomUUID()
  const first = catalogEntry({ kind: 'tag', name: `Boundary A ${unique}`, slug: `boundary-a-${unique}` })
  const second = catalogEntry({ kind: 'tag', name: `Boundary B ${unique}`, slug: `boundary-b-${unique}` })
  const saved = catalogEntry({
    kind: 'tag',
    id: second.id,
    name: 'Local change to B',
    slug: `local-b-${unique}`,
    version: second.version + 1,
  })
  const held = defer()
  const captured = defer()
  let listCalls = 0
  const view = mountCatalog({
    kind: 'tag',
    handlers: {
      'GET /api/admin/catalog/tag': async () => {
        listCalls += 1
        if (listCalls === 1) {
          return { body: catalogPage([first, second]) }
        }
        if (listCalls === 2) {
          captured.open()
          await held.promise
          return { body: catalogPage([first, second]) }
        }
        return { body: catalogPage([first, saved]) }
      },
      'PUT /api/admin/catalog/tag/:id': () => ({ body: saved }),
    },
  })
  try {
    await settleCatalog(view)
    const copy = catalogCopy.en
    act(() => {
      click(editButton(view.container, `${copy.edit} ${first.name}`))
    })
    expect(textInput(view.container, copy.name).value).toBe(first.name)
    expect(textInput(view.container, copy.slug).value).toBe(first.slug)
    act(() => {
      click(button(view.container, copy.refresh))
    })
    await captured.promise
    act(() => {
      click(editButton(view.container, `${copy.edit} ${second.name}`))
    })
    typeText(textInput(view.container, copy.name), 'Local change to B')
    typeText(textInput(view.container, copy.slug), `local-b-${unique}`)
    held.open()
    await settleCatalog(view)
    act(() => {
      click(button(view.container, copy.save))
    })
    await settleCatalog(view)
    const write = view.api.calls.find(call => call.method === 'PUT')
    expect(write?.path).toBe(`/api/admin/catalog/tag/${second.id}`)
    expect(write?.json).toEqual({
      name: 'Local change to B',
      slug: `local-b-${unique}`,
      retired: false,
      color: 'neutral',
      expectedVersion: second.version,
    })
    await expectToast(view, copy.saved)
  }
  finally {
    held.open()
  }
})

/* eslint-disable-next-line max-lines-per-function -- This case follows one held series refresh through its save. */
it('a slow series refresh cannot retarget a different entry\'s form', async () => {
  const unique = crypto.randomUUID()
  const first = catalogEntry({ kind: 'series', name: `Boundary A ${unique}`, slug: `boundary-a-${unique}` })
  const second = catalogEntry({ kind: 'series', name: `Boundary B ${unique}`, slug: `boundary-b-${unique}` })
  const saved = catalogEntry({
    kind: 'series',
    id: second.id,
    name: 'Local change to B',
    slug: `local-b-${unique}`,
    version: second.version + 1,
  })
  const held = defer()
  const captured = defer()
  let listCalls = 0
  const view = mountCatalog({
    kind: 'series',
    handlers: {
      'GET /api/admin/catalog/series': async () => {
        listCalls += 1
        if (listCalls === 1) {
          return { body: catalogPage([first, second]) }
        }
        if (listCalls === 2) {
          captured.open()
          await held.promise
          return { body: catalogPage([first, second]) }
        }
        return { body: catalogPage([first, saved]) }
      },
      'PUT /api/admin/catalog/series/:id': () => ({ body: saved }),
    },
  })
  try {
    await settleCatalog(view)
    const copy = catalogCopy.en
    act(() => {
      click(editButton(view.container, `${copy.edit} ${first.name}`))
    })
    act(() => {
      click(button(view.container, copy.refresh))
    })
    await captured.promise
    act(() => {
      click(editButton(view.container, `${copy.edit} ${second.name}`))
    })
    typeText(textInput(view.container, copy.name), 'Local change to B')
    typeText(textInput(view.container, copy.slug), `local-b-${unique}`)
    held.open()
    await settleCatalog(view)
    act(() => {
      click(button(view.container, copy.save))
    })
    await settleCatalog(view)

    const write = view.api.calls.find(call => call.method === 'PUT')
    expect(write?.path).toBe(`/api/admin/catalog/series/${second.id}`)
    expect(write?.json).toEqual({
      name: 'Local change to B',
      slug: `local-b-${unique}`,
      retired: false,
      color: 'neutral',
      expectedVersion: second.version,
    })
    await expectToast(view, copy.saved)
  }
  finally {
    held.open()
  }
})

it('refreshing a clean tag form adopts remote fields without marking it dirty', async () => {
  const unique = crypto.randomUUID()
  const first = catalogEntry({ kind: 'tag', name: `Clean A ${unique}`, slug: `clean-a-${unique}` })
  const remote = catalogEntry({
    kind: 'tag',
    id: first.id,
    name: 'Remote catalog update',
    slug: `remote-${unique}`,
    retired: true,
    version: first.version + 1,
  })
  let listCalls = 0
  const view = mountCatalog({
    kind: 'tag',
    handlers: {
      'GET /api/admin/catalog/tag': () => ({
        body: catalogPage(listCalls++ === 0 ? [first] : [remote]),
      }),
    },
  })
  await settleCatalog(view)
  const copy = catalogCopy.en
  act(() => {
    click(editButton(view.container, `${copy.edit} ${first.name}`))
  })
  act(() => {
    click(button(view.container, copy.refresh))
  })
  await settleCatalog(view)

  expect(textInput(view.container, copy.name).value).toBe(remote.name)
  expect(textInput(view.container, copy.slug).value).toBe(remote.slug)
  expect(view.container.querySelector('[role="checkbox"]')?.getAttribute('aria-checked')).toBe('true')
  expect(button(view.container, copy.save).disabled).toBe(true)
  expect(view.container.textContent).not.toContain(copy.unsaved)
  expect(view.api.calls.filter(call => call.method !== 'GET')).toHaveLength(0)
})

it('refreshing a dirty tag form preserves local edits and adopts untouched remote fields', async () => {
  const unique = crypto.randomUUID()
  const first = catalogEntry({ kind: 'tag', name: `Dirty A ${unique}`, slug: `dirty-a-${unique}` })
  const remote = catalogEntry({
    kind: 'tag',
    id: first.id,
    name: 'Remote changed name',
    slug: `remote-${unique}`,
    retired: true,
    version: first.version + 1,
  })
  const saved = catalogEntry({
    kind: 'tag',
    id: first.id,
    name: 'Local name survives refresh',
    slug: remote.slug,
    retired: true,
    version: remote.version + 1,
  })
  let listCalls = 0
  const view = mountCatalog({
    kind: 'tag',
    handlers: {
      'GET /api/admin/catalog/tag': () => ({
        body: catalogPage(listCalls++ === 0 ? [first] : [remote]),
      }),
      'PUT /api/admin/catalog/tag/:id': () => ({ body: saved }),
    },
  })
  await settleCatalog(view)
  const copy = catalogCopy.en
  act(() => {
    click(editButton(view.container, `${copy.edit} ${first.name}`))
  })
  typeText(textInput(view.container, copy.name), 'Local name survives refresh')
  act(() => {
    click(button(view.container, copy.refresh))
  })
  await settleCatalog(view)
  expect(textInput(view.container, copy.name).value).toBe('Local name survives refresh')
  expect(textInput(view.container, copy.slug).value).toBe(remote.slug)
  expect(view.container.querySelector('[role="checkbox"]')?.getAttribute('aria-checked')).toBe('true')

  act(() => {
    click(button(view.container, copy.save))
  })
  await settleCatalog(view)
  const write = view.api.calls.find(call => call.method === 'PUT')
  expect(write?.json).toEqual({
    name: 'Local name survives refresh',
    slug: remote.slug,
    retired: true,
    color: 'neutral',
    expectedVersion: remote.version,
  })
  await expectToast(view, copy.saved)
})

it('a series form creates through the series endpoint', async () => {
  const created = catalogEntry({ kind: 'series', name: 'Series entry', slug: 'series-entry' })
  let listCalls = 0
  const view = mountCatalog({
    kind: 'series',
    handlers: {
      'GET /api/admin/catalog/series': () => ({
        body: catalogPage(listCalls++ === 0 ? [] : [created]),
      }),
      'POST /api/admin/catalog/series': () => ({ body: created }),
    },
  })
  await settleCatalog(view)
  const copy = catalogCopy.en
  expect(view.container.querySelector('h1')?.textContent).toBe(copy.series)
  expect(button(view.container, copy.newSeries)).toBeDefined()
  typeText(textInput(view.container, copy.name), created.name)
  typeText(textInput(view.container, copy.slug), created.slug)
  act(() => {
    click(button(view.container, copy.save))
  })
  await settleCatalog(view)

  const write = view.api.calls.find(call => call.method === 'POST')
  expect(write?.path).toBe('/api/admin/catalog/series')
  expect(write?.json).toEqual({ name: created.name, slug: created.slug, color: 'neutral' })
  await expectToast(view, copy.created)
  expect(editButton(view.container, `${copy.edit} ${created.name}`)).toBeDefined()
})

it('a confirmed catalog creation stays visible when the list refresh fails', async () => {
  const unique = crypto.randomUUID()
  const name = `Acknowledged ${unique}`
  const created = catalogEntry({ kind: 'tag', name, slug: `acknowledged-${unique}` })
  let listCalls = 0
  const view = mountCatalog({
    kind: 'tag',
    handlers: {
      'GET /api/admin/catalog/tag': () => {
        listCalls += 1
        return listCalls === 1 ? { body: catalogPage([]) } : failure(503, 'UNAVAILABLE')
      },
      'POST /api/admin/catalog/tag': () => ({ body: created }),
    },
  })
  await settleCatalog(view)
  const copy = catalogCopy.en
  typeText(textInput(view.container, copy.name), created.name)
  typeText(textInput(view.container, copy.slug), created.slug)
  act(() => {
    click(button(view.container, copy.save))
  })
  await settleCatalog(view)
  await expectToast(view, copy.created)
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(copy.loadError)
  expect(editButton(view.container, `${copy.edit} ${name}`)).toBeDefined()

  typeText(textInput(view.container, copy.name), 'Another unsaved entry')
  expect(view.api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
})

it('a slow refresh cannot turn a new catalog entry into an update of the old entry', async () => {
  const unique = crypto.randomUUID()
  const first = catalogEntry({ kind: 'tag', name: `Original ${unique}`, slug: `original-${unique}` })
  const created = catalogEntry({ kind: 'tag', name: 'A new catalog entry', slug: `new-after-refresh-${unique}` })
  const held = defer()
  const captured = defer()
  let listCalls = 0
  const view = mountCatalog({
    kind: 'tag',
    handlers: {
      'GET /api/admin/catalog/tag': async () => {
        listCalls += 1
        if (listCalls === 1) {
          return { body: catalogPage([first]) }
        }
        if (listCalls === 2) {
          captured.open()
          await held.promise
        }
        return { body: catalogPage([first, created]) }
      },
      'POST /api/admin/catalog/tag': () => ({ body: created }),
    },
  })
  try {
    await settleCatalog(view)
    const copy = catalogCopy.en
    act(() => {
      click(editButton(view.container, `${copy.edit} ${first.name}`))
      click(button(view.container, copy.refresh))
    })
    await captured.promise
    act(() => {
      click(button(view.container, copy.newTag))
    })
    typeText(textInput(view.container, copy.name), created.name)
    typeText(textInput(view.container, copy.slug), created.slug)
    held.open()
    await settleCatalog(view)

    act(() => {
      click(button(view.container, copy.save))
    })
    await settleCatalog(view)
    const writes = view.api.calls.filter(call => call.method === 'POST' || call.method === 'PUT')
    expect(writes).toHaveLength(1)
    expect(writes[0]?.method).toBe('POST')
    expect(writes[0]?.path).toBe('/api/admin/catalog/tag')
    expect(writes[0]?.json).toEqual({ name: created.name, slug: created.slug, color: 'neutral' })
    expect(editButton(view.container, `${copy.edit} ${first.name}`)).toBeDefined()
  }
  finally {
    held.open()
  }
})

it('catalog retries an unknown creation with the original idempotency key', async () => {
  const unique = crypto.randomUUID()
  const created = catalogEntry({ kind: 'tag', name: `Unknown creation ${unique}`, slug: `unknown-${unique}` })
  let committed = false
  let posts = 0
  const view = mountCatalog({
    kind: 'tag',
    handlers: {
      'GET /api/admin/catalog/tag': () => ({
        body: catalogPage(committed ? [created] : []),
      }),
      'POST /api/admin/catalog/tag': () => {
        committed = true
        posts += 1
        return posts === 1 ? lostResponse() : { body: created }
      },
    },
  })
  await settleCatalog(view)
  const copy = catalogCopy.en
  typeText(textInput(view.container, copy.name), created.name)
  typeText(textInput(view.container, copy.slug), created.slug)
  act(() => {
    click(button(view.container, copy.save))
  })
  await settleCatalog(view)
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(copy.connectionFailed)
  expect(view.container.querySelector('[data-sonner-toast]')).toBeNull()

  act(() => {
    click(button(view.container, copy.refresh))
  })
  await settleCatalog(view)
  expect(editButton(view.container, `${copy.edit} ${created.name}`)).toBeDefined()
  act(() => {
    click(button(view.container, copy.save))
  })
  await settleCatalog(view)

  const writes = view.api.calls.filter(call => call.method === 'POST')
  expect(writes).toHaveLength(2)
  expect(writes.map(call => call.path)).toEqual(['/api/admin/catalog/tag', '/api/admin/catalog/tag'])
  expect(writes.map(call => call.json)).toEqual([
    { name: created.name, slug: created.slug, color: 'neutral' },
    { name: created.name, slug: created.slug, color: 'neutral' },
  ])
  const firstKey = writes[0]?.headers['idempotency-key']
  expect(firstKey).toEqual(expect.any(String))
  expect(firstKey).not.toBe('')
  expect(writes[1]?.headers['idempotency-key']).toBe(firstKey)
  await expectToast(view, copy.created)
  expect(view.container.querySelectorAll(`button[aria-label="${copy.edit} ${created.name}"]`)).toHaveLength(1)
})
