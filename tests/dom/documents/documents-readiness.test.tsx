import { afterEach, expect, it } from 'vitest'
import { documentsCopy } from '~/tests/dom/shared/copy'
import { documentEntry, documentsPage } from '~/tests/dom/shared/fixtures'
import { defer } from '~/tests/dom/shared/http'
import {
  drainHostTask,
  mountDocuments,
  resetDocumentsDom,
  settleDocuments,
  until,
} from './documents-support'

afterEach(resetDocumentsDom)

it('the list mounts while its list request is still unanswered', async () => {
  const entry = documentEntry({ title: 'Readiness row' })
  const held = defer()
  const view = mountDocuments({
    handlers: {
      'GET /api/admin/documents': async () => {
        await held.promise
        return { body: documentsPage([entry]) }
      },
    },
  })
  try {
    await drainHostTask()
    const copy = documentsCopy.en
    await until(() => view.container.querySelector('h1')?.textContent === copy.title)
    expect(view.container.querySelector('.document-list-panel')?.getAttribute('aria-busy')).toBe('true')
    expect(view.container.querySelector('.document-loading [role="status"]')?.textContent).toBe(copy.loading)
    expect(view.api.calls).toHaveLength(1)

    held.open()
    await settleDocuments(view)
    expect(view.container.querySelector(`a[href="/admin/documents/${entry.documentId}"]`)?.textContent)
      .toBe(entry.title)
  }
  finally {
    held.open()
  }
})
