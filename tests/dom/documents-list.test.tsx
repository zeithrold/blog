import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import {
  acknowledgementFor,
  documentEntry,
  documentsPage,
  publishedEntry,
  selectDocuments,
} from '~/tests/components/support/domain-fixtures'
import { documentsCopy } from '~/tests/components/support/expected-copy'
import {
  all,
  button,
  click,
  combobox,
  mountDocuments,
  one,
  openCombobox,
  option,
  press,
  resetDocumentsDom,
  settleDocuments,
  text,
  textInput,
  typeText,
} from './documents-support'
import { failure } from './http'

afterEach(resetDocumentsDom)

async function choose(view: ReturnType<typeof mountDocuments>, label: string, value: string): Promise<void> {
  openCombobox(combobox(view.container, label))
  press(option(document, value), 'Enter')
  await settleDocuments(view)
}

it('a failed first load offers Try again and the retry renders the list', async () => {
  const entry = documentEntry({ title: 'Recovered document' })
  let calls = 0
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': (call) => {
        calls += 1
        return calls === 1
          ? failure(503, 'UNAVAILABLE')
          : selectDocuments([entry], call)
      },
    },
  })

  await settleDocuments(view)
  const alert = one<HTMLDivElement>(view.container, '[role="alert"]')
  expect(alert.textContent).toContain(documentsCopy.en.loadError)
  act(() => {
    click(button(alert, documentsCopy.en.retry))
  })
  await settleDocuments(view)

  expect(view.container.querySelector('[role="alert"]')).toBeNull()
  expect(view.container.querySelector(`[href="/admin/documents/${entry.documentId}"]`)?.textContent)
    .toBe(entry.title)
  expect(calls).toBe(2)
})

it('filters narrow the list and their chips remove individually', async () => {
  const prefix = 'DOM filter case'
  const pageTarget = documentEntry({ kind: 'page', title: `${prefix} page target` })
  const postTarget = documentEntry({ title: `${prefix} post target` })
  const published = publishedEntry({ title: `${prefix} published target` })
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': call => selectDocuments([
        pageTarget,
        postTarget,
        published,
      ], call),
    },
  })
  await settleDocuments(view)
  const copy = documentsCopy.en
  const list = () => one<HTMLUListElement>(view.container, `[aria-label="${copy.title}"]`)
  expect(list().querySelectorAll('a')).toHaveLength(3)

  const search = textInput(view.container, copy.search)
  typeText(search, prefix)
  act(() => {
    click(button(view.container, copy.submit))
  })
  await settleDocuments(view)
  await choose(view, copy.kind, 'Page')
  await choose(view, copy.state, copy.draft)
  expect(list().querySelectorAll('a')).toHaveLength(1)
  expect(list().textContent).toContain(pageTarget.title)

  const active = () => one<HTMLUListElement>(view.container, `[aria-label="${copy.activeFilters}"]`)
  expect(active().querySelectorAll('button')).toHaveLength(3)
  const typeChip = one<HTMLButtonElement>(
    active(),
    `button[aria-label="${copy.removeFilter}: ${copy.kind}: Page"]`,
  )
  act(() => {
    click(typeChip)
  })
  await settleDocuments(view)
  expect(combobox(view.container, copy.kind).textContent).toContain(copy.allKinds)
  expect(list().querySelectorAll('a')).toHaveLength(2)

  await choose(view, copy.kind, 'Page')
  const searchChip = one<HTMLButtonElement>(
    active(),
    `button[aria-label="${copy.removeFilter}: ${copy.search}: ${prefix}"]`,
  )
  act(() => {
    click(searchChip)
  })
  await settleDocuments(view)
  expect(search.value).toBe('')
  expect(active().querySelectorAll('button')).toHaveLength(2)
})

it('clearing filters restores the unfiltered list', async () => {
  const draft = documentEntry({ kind: 'page', title: 'Clear filters draft' })
  const published = publishedEntry({ title: 'Clear filters published' })
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': call => selectDocuments([draft, published], call),
    },
  })
  await settleDocuments(view)
  const copy = documentsCopy.en
  const list = () => one<HTMLUListElement>(view.container, `[aria-label="${copy.title}"]`)
  expect(list().querySelectorAll('a')).toHaveLength(2)

  const search = textInput(view.container, copy.search)
  typeText(search, 'No document will match this title')
  act(() => {
    click(button(view.container, copy.submit))
  })
  await settleDocuments(view)
  expect(view.container.textContent).toContain(copy.noMatches)
  expect(view.container.querySelectorAll(`[aria-label="${copy.title}"] a`)).toHaveLength(0)

  act(() => {
    click(button(view.container, copy.clear))
  })
  await settleDocuments(view)
  expect(combobox(view.container, copy.kind).textContent).toContain(copy.allKinds)
  expect(search.value).toBe('')
  expect(list().querySelector(`a[href="/admin/documents/${published.documentId}"]`)?.textContent)
    .toBe(published.title)
  expect(list().querySelectorAll('a')).toHaveLength(2)
})

it('rows render the draft, published and changed badges', async () => {
  const draft = documentEntry({ title: 'Badge draft' })
  const published = publishedEntry({ title: 'Badge published' })
  const changed = documentEntry({ title: 'Badge changed', liveRevisionId: crypto.randomUUID() })
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': call => selectDocuments([
        draft,
        published,
        changed,
      ], call),
    },
  })
  await settleDocuments(view)
  const rows = all<HTMLLIElement>(view.container, '[aria-label="Documents"] li')
  expect(rows).toHaveLength(3)
  const states: readonly (readonly [string, string, string])[] = [
    [
      draft.title,
      'draft',
      documentsCopy.en.draft,
    ],
    [
      published.title,
      'live',
      documentsCopy.en.published,
    ],
    [
      changed.title,
      'changed',
      documentsCopy.en.changed,
    ],
  ]
  for (const [title, state, label] of states) {
    const row = rows.find(item => item.textContent.includes(title))
    if (row === undefined) {
      throw new Error(`No row rendered for ${title}`)
    }
    const badge = row.querySelector('.status-badge')
    expect(badge?.getAttribute('data-state')).toBe(state)
    expect(badge?.textContent).toBe(label)
  }
  const draftRow = rows.find(item => item.textContent.includes(draft.title))
  expect(draftRow?.textContent).toContain('Post')
})

it('trash rows restore to drafts and leave the trash list', async () => {
  const target = documentEntry({ title: 'Trash boundary target', version: 4 })
  const other = documentEntry({ title: 'Trash boundary other' })
  const restored = documentEntry({ ...target, version: target.version + 1 })
  let restoreCommitted = false
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': (call) => {
        const trash = call.query.get('state') === 'deleted'
        return trash
          ? { body: documentsPage(restoreCommitted ? [other] : [target, other]) }
          : selectDocuments([restored], call)
      },
      'POST /api/admin/documents/:id/restore-deleted': () => {
        restoreCommitted = true
        return { body: acknowledgementFor(restored) }
      },
    },
  })
  await settleDocuments(view)
  const copy = documentsCopy.en
  await choose(view, copy.state, copy.trash)
  const list = one<HTMLUListElement>(view.container, `[aria-label="${copy.title}"]`)
  expect(list.querySelectorAll('li')).toHaveLength(2)
  expect(list.querySelectorAll('a')).toHaveLength(0)
  const row = Array.from(list.querySelectorAll('li'))
    .find(item => item.textContent.includes(target.title))
  if (row === undefined) {
    throw new Error(`No trash row rendered for ${target.title}`)
  }
  const restore = button(row, copy.restore)
  expect(restore.getAttribute('aria-describedby')).not.toBeNull()
  expect(document.getElementById(restore.getAttribute('aria-describedby') ?? '')?.textContent)
    .toBe(target.title)

  act(() => {
    click(restore)
  })
  await settleDocuments(view)
  expect(view.container.querySelector('[role="status"]')?.textContent).toContain(copy.restored)
  expect(Array.from(list.querySelectorAll('li')).some(item => item.textContent.includes(target.title)))
    .toBe(false)
  const restoreCall = view.api.calls.find(call => call.method === 'POST')
  expect(restoreCall?.path).toBe(`/api/admin/documents/${target.documentId}/restore-deleted`)
  expect(restoreCall?.json).toEqual({ expectedVersion: target.version })

  await choose(view, copy.state, copy.draft)
  const restoredLink = one<HTMLAnchorElement>(
    view.container,
    `[aria-label="${copy.title}"] a[href="/admin/documents/${target.documentId}"]`,
  )
  expect(restoredLink.textContent).toBe(restored.title)
  expect(restoreCall?.headers['idempotency-key']).toEqual(expect.any(String))
})

it('Chinese labels render in the compact viewport', async () => {
  const draft = documentEntry({ kind: 'page', title: '页面草稿' })
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': call => selectDocuments([draft], call),
    },
    locale: 'zh',
    width: 320,
  })
  await settleDocuments(view)
  const copy = documentsCopy.zh
  expect(text(view.container, 'h1')).toBe(copy.title)
  expect(textInput(view.container, copy.search)).toBeDefined()
  await choose(view, copy.state, copy.draft)
  expect(combobox(view.container, copy.state).textContent).toContain(copy.draft)
  expect(button(view.container, copy.newPost)).toBeDefined()
  expect(combobox(view.container, copy.kind)).toBeDefined()
  expect(all(view.container, '[role="dialog"]')).toHaveLength(0)
})
