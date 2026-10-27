import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { documentsCopy } from '~/tests/dom/shared/copy'
import { documentEntry, selectDocuments } from '~/tests/dom/shared/fixtures'
import { defer } from '~/tests/dom/shared/http'
import {
  button,
  click,
  drainHostTask,
  mountDocuments,
  resetDocumentsDom,
  settleDocuments,
  textInput,
} from './documents-support'

afterEach(resetDocumentsDom)

function expectPreloadSummary(locale: 'en' | 'zh', view: ReturnType<typeof mountDocuments>): void {
  const expected = locale === 'en' ? 'Most recently updated first' : '按最近更新时间排序'
  expect(view.container.querySelector('.document-list-summary p')?.textContent.trim()).toBe(expected)
}

async function loadingStates(locale: 'en' | 'zh', width: number): Promise<void> {
  const entry = documentEntry({ title: `Loading ${locale} row` })
  let held = defer()
  let calls = 0
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': async (call) => {
        calls += 1
        await held.promise
        return selectDocuments([entry], call)
      },
    },
    locale,
    width,
  })
  try {
    await drainHostTask()
    const copy = documentsCopy[locale]
    const panel = view.container.querySelector('.document-list-panel')
    const loading = view.container.querySelector('.document-loading [role="status"]')
    const search = textInput(view.container, copy.search)
    expect(calls).toBe(1)
    expect(panel?.getAttribute('aria-busy')).toBe('true')
    expect(loading?.textContent).toBe(copy.loading)
    expect(view.container.querySelectorAll('.document-skeleton-row')).toHaveLength(4)
    expectPreloadSummary(locale, view)

    held.open()
    await settleDocuments(view)
    expect(view.container.querySelector(`a[href="/admin/documents/${entry.documentId}"]`)?.textContent)
      .toBe(entry.title)

    held = defer()
    act(() => {
      click(button(view.container, copy.refresh))
    })
    await drainHostTask()
    expect(calls).toBe(2)
    expect(panel?.getAttribute('aria-busy')).toBe('true')
    expect(view.container.querySelector('.document-loading [role="status"]')?.textContent)
      .toBe(copy.loading)
    expect(view.container.querySelectorAll('.document-skeleton-row')).toHaveLength(0)
    expect(view.container.querySelector(`a[href="/admin/documents/${entry.documentId}"]`)?.textContent)
      .toBe(entry.title)
    expect(search.disabled).toBe(false)
    expect(button(view.container, copy.submit).disabled).toBe(false)

    held.open()
    await settleDocuments(view)
    expect(panel?.getAttribute('aria-busy')).toBe('false')
    expect(view.container.querySelector('.document-loading')).toBeNull()
    expect(view.container.querySelector(`a[href="/admin/documents/${entry.documentId}"]`)?.textContent)
      .toBe(entry.title)
  }
  finally {
    held.open()
  }
}

it('English first load and refresh expose the expected DOM states', async () => {
  await loadingStates('en', 1440)
})

it('Chinese first load and refresh expose the expected DOM states', async () => {
  await loadingStates('zh', 320)
})
