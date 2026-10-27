/* eslint-disable max-lines -- Five related boundary cases share their route fixtures. */
import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { documentsCopy } from '~/tests/dom/shared/copy'
import {
  acknowledgementFor,
  documentEntry,
  documentFilters,
  documentsPage,
  selectDocuments,
} from '~/tests/dom/shared/fixtures'
import { defer, failure, lostResponse } from '~/tests/dom/shared/http'
import {
  button,
  click,
  combobox,
  drainHostTask,
  mountDocuments,
  one,
  openCombobox,
  option,
  press,
  resetDocumentsDom,
  settleDocuments,
  textInput,
  typeText,
} from './documents-support'

afterEach(resetDocumentsDom)

function documentList(view: ReturnType<typeof mountDocuments>, title: string): HTMLUListElement {
  return one<HTMLUListElement>(view.container, `[aria-label="${title}"]`)
}

function documentRow(list: ParentNode, title: string): HTMLLIElement {
  const row = Array.from(list.querySelectorAll('li')).find(item => item.textContent.includes(title))
  if (row === undefined) {
    throw new Error(`No document row rendered for ${title}`)
  }
  return row
}

async function choose(
  view: ReturnType<typeof mountDocuments>,
  label: string,
  value: string,
): Promise<void> {
  openCombobox(combobox(view.container, label))
  press(option(document, value), 'Enter')
  await settleDocuments(view)
}

async function showTrash(view: ReturnType<typeof mountDocuments>): Promise<void> {
  await choose(view, documentsCopy.en.state, documentsCopy.en.trash)
}

it('pagination retries the same cursor and merges without duplicate rows', async () => {
  const repeated = documentEntry({ title: 'Boundary repeated document' })
  const firstPage = [
    repeated,
    ...Array.from({ length: 49 }, (_, index) => documentEntry({
      title: `Boundary document ${index}`,
      updatedAt: Date.UTC(2026, 0, 1) - index,
    })),
  ]
  const next = documentEntry({ title: 'Boundary next page document' })
  let calls = 0
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': () => {
        calls += 1
        if (calls === 1) {
          return { body: documentsPage(firstPage, 'boundary-next') }
        }
        if (calls === 2) {
          return failure(503, 'UNAVAILABLE')
        }
        return { body: documentsPage([repeated, next]) }
      },
    },
  })
  await settleDocuments(view)
  const copy = documentsCopy.en
  const list = documentList(view, copy.title)
  expect(list.querySelectorAll('li')).toHaveLength(50)
  act(() => {
    click(button(view.container, 'Load more'))
  })
  await settleDocuments(view)
  const alert = one<HTMLDivElement>(view.container, '[role="alert"]')
  expect(alert.textContent).toContain(copy.moreError)
  expect(list.querySelectorAll('li')).toHaveLength(50)

  act(() => {
    click(button(alert, copy.retry))
  })
  await settleDocuments(view)
  expect(view.container.querySelector('[role="alert"]')).toBeNull()
  expect(list.querySelectorAll('li')).toHaveLength(51)
  expect(view.container.querySelector('.more-button')).toBeNull()
  expect(list.querySelectorAll(`a[href="/admin/documents/${repeated.documentId}"]`)).toHaveLength(1)
  expect(list.querySelector(`a[href="/admin/documents/${next.documentId}"]`)?.textContent).toBe(next.title)
  expect(view.api.calls.map(call => documentFilters(call.query).cursor)).toEqual([
    null,
    'boundary-next',
    'boundary-next',
  ])
})

/* eslint-disable-next-line max-lines-per-function -- One held-restore lifecycle. */
it('a confirmed restore survives a failed refresh and preserves the list state', async () => {
  const target = documentEntry({ title: 'Restore boundary target', version: 2 })
  const other = documentEntry({ title: 'Restore boundary other' })
  const held = defer()
  const captured = defer()
  let listCalls = 0
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': async (call) => {
        listCalls += 1
        if (listCalls <= 2) {
          return selectDocuments([target, other], call)
        }
        if (listCalls === 3) {
          captured.open()
          await held.promise
          return failure(503, 'UNAVAILABLE')
        }
        return { body: documentsPage([other]) }
      },
      'POST /api/admin/documents/:id/restore-deleted': () => ({
        body: acknowledgementFor(target, { version: target.version + 1 }),
      }),
    },
  })
  try {
    await settleDocuments(view)
    const copy = documentsCopy.en
    await showTrash(view)
    const list = documentList(view, copy.title)
    const search = textInput(view.container, copy.search)
    typeText(search, 'Unsubmitted search text')
    const targetRow = documentRow(list, target.title)
    const siblingRow = documentRow(list, other.title)
    act(() => {
      click(button(targetRow, copy.restore))
    })
    await act(async () => {
      await captured.promise
    })
    await drainHostTask()
    expect(Array.from(list.querySelectorAll('li')).some(row => row.textContent.includes(target.title)))
      .toBe(false)
    expect(button(siblingRow, copy.restore).disabled).toBe(true)
    expect(search.value).toBe('Unsubmitted search text')
    held.open()
    await settleDocuments(view)

    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(copy.loadError)
    expect(view.container.querySelector('[role="status"]')?.textContent).toContain(copy.restored)
    expect(button(siblingRow, copy.restore).disabled).toBe(false)
    expect(Array.from(list.querySelectorAll('li')).some(row => row.textContent.includes(target.title)))
      .toBe(false)
    const write = view.api.calls.find(call => call.method === 'POST')
    expect(write?.path).toBe(`/api/admin/documents/${target.documentId}/restore-deleted`)
    expect(write?.json).toEqual({ expectedVersion: target.version })

    act(() => {
      click(button(view.container, copy.retry))
    })
    await settleDocuments(view)
    expect(view.container.querySelector('[role="alert"]')).toBeNull()
    expect(search.value).toBe('Unsubmitted search text')
    expect(combobox(view.container, copy.state).textContent).toContain(copy.trash)
    expect(Array.from(list.querySelectorAll('li')).map(row => row.textContent.trim())).toEqual([
      expect.stringContaining(other.title),
    ])
  }
  finally {
    held.open()
  }
})

it('Chinese restore notices render in the compact viewport', async () => {
  const target = documentEntry({ title: '窄屏恢复 target', version: 2 })
  const other = documentEntry({ title: '窄屏恢复 other' })
  const held = defer()
  const captured = defer()
  let listCalls = 0
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': async (call) => {
        listCalls += 1
        if (listCalls <= 2) {
          return selectDocuments([target, other], call)
        }
        if (listCalls === 3) {
          captured.open()
          await held.promise
          return failure(503, 'UNAVAILABLE')
        }
        return { body: documentsPage([other]) }
      },
      'POST /api/admin/documents/:id/restore-deleted': () => ({
        body: acknowledgementFor(target, { version: target.version + 1 }),
      }),
    },
    locale: 'zh',
    width: 320,
  })
  try {
    await settleDocuments(view)
    const copy = documentsCopy.zh
    await choose(view, copy.state, copy.trash)
    const row = documentRow(documentList(view, copy.title), target.title)
    act(() => {
      click(button(row, copy.restore))
    })
    await act(async () => {
      await captured.promise
    })
    held.open()
    await settleDocuments(view)
    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(copy.loadError)
    expect(view.container.querySelector('[role="status"]')?.textContent).toContain(copy.restored)
  }
  finally {
    held.open()
  }
})

it('a lost restore response retries with the same idempotency key', async () => {
  const target = documentEntry({ title: 'Lost response target' })
  const other = documentEntry({ title: 'Lost response other' })
  let committed = false
  let posts = 0
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': (call) => {
        const { state } = documentFilters(call.query)
        return state === 'deleted'
          ? { body: documentsPage(committed ? [other] : [target, other]) }
          : selectDocuments([target, other], call)
      },
      'POST /api/admin/documents/:id/restore-deleted': () => {
        posts += 1
        if (posts === 1) {
          return lostResponse()
        }
        committed = true
        return { body: acknowledgementFor(target, { version: target.version + 1 }) }
      },
    },
  })
  await settleDocuments(view)
  await showTrash(view)
  const copy = documentsCopy.en
  const list = documentList(view, copy.title)
  const row = documentRow(list, target.title)
  act(() => {
    click(button(row, copy.restore))
  })
  await settleDocuments(view)
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(copy.restoreUnknown)

  act(() => {
    click(button(view.container, copy.retry))
  })
  await settleDocuments(view)
  expect(view.container.querySelector('[role="status"]')?.textContent).toContain(copy.restored)
  expect(Array.from(list.querySelectorAll('li')).some(item => item.textContent.includes(target.title)))
    .toBe(false)
  const writes = view.api.calls.filter(call => call.method === 'POST')
  expect(writes).toHaveLength(2)
  expect(writes.map(call => call.path)).toEqual([
    `/api/admin/documents/${target.documentId}/restore-deleted`,
    `/api/admin/documents/${target.documentId}/restore-deleted`,
  ])
  expect(writes.map(call => call.json)).toEqual([
    { expectedVersion: target.version },
    { expectedVersion: target.version },
  ])
  const firstKey = writes[0]?.headers['idempotency-key']
  expect(firstKey).toEqual(expect.any(String))
  expect(firstKey).not.toBe('')
  expect(writes[1]?.headers['idempotency-key']).toBe(firstKey)
})

it('a restore conflict refreshes before another attempt', async () => {
  const target = documentEntry({ title: 'Conflict target', version: 3 })
  const other = documentEntry({ title: 'Conflict other' })
  let restores = 0
  let committed = false
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': (call) => {
        const { state } = documentFilters(call.query)
        return state === 'deleted'
          ? { body: documentsPage(committed ? [other] : [target, other]) }
          : selectDocuments([target, other], call)
      },
      'POST /api/admin/documents/:id/restore-deleted': () => {
        restores += 1
        if (restores === 1) {
          return failure(409, 'EDIT_CONFLICT')
        }
        committed = true
        return { body: acknowledgementFor(target, { version: target.version + 1 }) }
      },
    },
  })
  await settleDocuments(view)
  await showTrash(view)
  const copy = documentsCopy.en
  const list = documentList(view, copy.title)
  const row = documentRow(list, target.title)
  act(() => {
    click(button(row, copy.restore))
  })
  await settleDocuments(view)
  const alert = one<HTMLDivElement>(view.container, '[role="alert"]')
  expect(alert.textContent).toContain(copy.conflict)
  act(() => {
    click(button(alert, copy.refresh))
  })
  await settleDocuments(view)
  expect(view.container.querySelector('[role="alert"]')).toBeNull()
  expect(restores).toBe(1)

  const refreshedRow = documentRow(list, target.title)
  act(() => {
    click(button(refreshedRow, copy.restore))
  })
  await settleDocuments(view)
  expect(restores).toBe(2)
  expect(Array.from(list.querySelectorAll('li')).some(item => item.textContent.includes(target.title)))
    .toBe(false)
})
