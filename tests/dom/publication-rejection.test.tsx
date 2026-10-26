import type { StubReply } from './publication-stub'
import type { MountedPublication } from './publication-support'
import { act } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { validateDocument } from '@/content/document'
import { saveSchema } from '@/contracts/documents'
import { publishSchema } from '@/contracts/publication'
import {
  acceptSave,
  failure,
  incompleteDocument,
  publicationDocument,
  publicationServer,
  twoTableDocument,
} from './publication-stub'
import {
  advance,
  mountPublication,
  resetDomPilot,
  texts,
} from './publication-support'

/*
 * Publication rejection and save-failure state: the real draft coordinator,
 * client, validation and notice components. The editor boundary supplies the
 * document only; every request, retry and rendered reason comes from product
 * code. Layout, scrolling and focus stay with the retained component cases.
 */

afterEach(() => {
  vi.useRealTimers()
  resetDomPilot()
})

const issueText = {
  en: [
    'Add a document title.',
    'Use a valid, unreserved slug.',
    'Add a caption to each table.',
    'Select a file for each empty media block, or remove the block.',
    'Add image alternative text or mark the image as decorative.',
  ],
  zh: [
    '请填写文档标题。',
    '请填写有效且非保留的 Slug。',
    '请为各表格填写标题说明。',
    '请为空的媒体块选择文件，或删除该块。',
    '请为图片填写替代文本，或标记为装饰图片。',
  ],
} as const

const rejectionHeading = {
  en: 'Publication checks failed',
  zh: '发布未通过检查',
} as const

function writeCalls(view: MountedPublication, route: string) {
  return view.stub.calls.filter(call => `${call.method} ${call.path}` === route)
}

async function publish(view: MountedPublication): Promise<void> {
  await act(async () => {
    const state = view.state()
    state.workspace.run(state.actions.publish())
    await state.settle()
  })
}

for (const locale of ['en', 'zh'] as const) {
  it(`publication explains every rejection in ${locale}`, async () => {
    const open = incompleteDocument()
    const server = publicationServer(open)
    const issues = [
      'title',
      'slug',
      'table',
      'mediaSource',
      'image',
    ] as const
    const view = mountPublication({
      server,
      locale: locale === 'zh' ? 'zh-CN' : 'en',
      writes: {
        'POST /api/admin/documents/:id/publish': () =>
          failure(422, 'PUBLICATION_INVALID', [
            ...issues,
          ]),
      },
    })
    await view.load()
    await publish(view)
    const notice = '.editor-notice[data-tone="error"]'
    expect(view.container.querySelectorAll(notice)).toHaveLength(1)
    expect(texts(view.container, `${notice} [data-publication-description]`))
      .toEqual(issueText[locale])
    expect(view.container.querySelector(`${notice} h2`)?.textContent)
      .toBe(rejectionHeading[locale])
    const rendered = view.container.querySelector(notice)?.textContent ?? ''
    expect(rendered).not.toContain('PUBLICATION_INVALID')
    expect(rendered).not.toContain('INVALID_DOCUMENT')
    expect(view.state().workspace.draft.rejection?.issues).toEqual([
      ...issues,
    ])
    expect(view.state().workspace.draft.rejection?.attempt).toBe(1)
    const attempts = writeCalls(view, `POST /api/admin/documents/${open.documentId}/publish`)
    expect(attempts).toHaveLength(1)
    expect(publishSchema.parse(attempts[0]?.body)).toEqual({
      expectedVersion: open.version,
      expectedLiveGeneration: open.liveGeneration,
      revisionId: open.headRevisionId,
    })
  })
}

const failures = [
  {
    status: 413,
    code: 'DOCUMENT_TOO_LARGE',
    label: 'The document exceeds the size limit. Shorten the content or split it '
      + 'into multiple documents, then save again.',
    saveStatus: 'error',
  },
  {
    status: 422,
    code: 'INVALID_DOCUMENT',
    label: 'The document failed validation. Check required fields, references and media settings, then retry.',
    saveStatus: 'error',
  },
  {
    status: 0,
    code: 'CONNECTION_FAILED',
    label: 'Connection failed. Your local changes are kept; retry when connected.',
    saveStatus: 'offline',
  },
] as const

for (const failureCase of failures) {
  it(`publishing retains the save failure reason ${failureCase.code} and permits correction`, async () => {
    let failSaves = true
    let savedHead: string | undefined
    const server = publicationServer(publicationDocument('Save failure'))
    const view = mountPublication({
      server,
      writes: {
        'PUT /api/admin/documents/:id/revisions': (call): StubReply => {
          if (failSaves) {
            return failureCase.status === 0
              ? 'disconnected'
              : failure(failureCase.status, failureCase.code)
          }
          const reply = acceptSave(server, call)
          savedHead = server.open.headRevisionId
          return reply
        },
      },
    })
    await view.load()
    const publishRoute = `POST /api/admin/documents/${view.server.open.documentId}/publish`
    const saveRoute = `PUT /api/admin/documents/${view.server.open.documentId}/revisions`
    view.editTitle('Changed draft')
    await publish(view)
    const notice = '.editor-notice[data-tone="error"]'
    expect(view.container.querySelector(notice)?.textContent).toContain(failureCase.label)
    expect(view.container.querySelector('.save-status')?.getAttribute('data-status'))
      .toBe(failureCase.saveStatus)
    expect(writeCalls(view, publishRoute)).toHaveLength(0)
    expect(writeCalls(view, saveRoute)).toHaveLength(1)
    // A retried publish before correction changes nothing: no second write and
    // the reason stays visible.
    await publish(view)
    expect(view.container.querySelector(notice)?.textContent).toContain(failureCase.label)
    expect(view.container.querySelector(notice)?.textContent).not.toContain('Wait for the draft')
    expect(writeCalls(view, publishRoute)).toHaveLength(0)
    expect(writeCalls(view, saveRoute)).toHaveLength(failureCase.status === 0 ? 2 : 1)
    failSaves = false
    view.editTitle('Corrected draft')
    await publish(view)
    expect(view.container.querySelector(notice)).toBeNull()
    expect(view.container.querySelector('.save-status')?.getAttribute('data-status'))
      .toBe('saved')
    expect(view.state().workspace.draft.ack.liveRevisionId).not.toBeNull()
    const published = writeCalls(view, publishRoute)
    expect(published).toHaveLength(1)
    expect(publishSchema.parse(published[0]?.body).revisionId).toBe(savedHead)
    const saved = writeCalls(view, saveRoute).at(-1)
    expect(validateDocument(saveSchema.parse(saved?.body).document).meta.title)
      .toBe('Corrected draft')
  })
}

it('server-only publication reasons render without a locator and take focus', async () => {
  const open = publicationDocument('Server-only reason')
  const view = mountPublication({
    server: publicationServer(open),
    writes: {
      'POST /api/admin/documents/:id/publish': () => failure(422, 'PUBLICATION_INVALID', ['image']),
    },
  })
  await view.load()
  await publish(view)
  const notice = '.editor-notice[data-tone="error"]'
  expect(texts(view.container, `${notice} [data-publication-description]`))
    .toEqual(['Add image alternative text or mark the image as decorative.'])
  expect(view.container.querySelectorAll(`${notice} button`)).toHaveLength(0)
  // The production notice focuses its own element; jsdom only reads it.
  expect(document.activeElement).toBe(view.container.querySelector(notice))
})

it('publication reasons survive a failed autosave and a successful retry', async () => {
  const open = twoTableDocument('Prior rejection')
  let failSave = true
  const server = publicationServer(open)
  const view = mountPublication({
    server,
    writes: {
      'POST /api/admin/documents/:id/publish': () => failure(422, 'PUBLICATION_INVALID', ['table']),
      'PUT /api/admin/documents/:id/revisions': (call): StubReply => {
        if (failSave) {
          failSave = false
          return failure(503, 'CONNECTION_FAILED')
        }
        return acceptSave(server, call)
      },
    },
  })
  await view.load()
  await publish(view)
  const notice = '.editor-notice[data-tone="error"]'
  expect(texts(view.container, `${notice} [data-publication-description]`))
    .toEqual(['Add a caption to each table.'])
  const tableLocators = () =>
    Array.from(view.container.querySelectorAll('button'))
      .filter(element => element.getAttribute('aria-label')?.includes('Add a caption to each table') === true)
  expect(tableLocators()).toHaveLength(1)
  expect(tableLocators()[0]?.textContent).toContain('2 blocks')
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  // The title path changes the envelope, so useDraftErrors recomputes against
  // the two real uncaptioned tables; the content transaction also proves the
  // production onChange -> lifecycle -> changed chain.
  view.editTitle('Changed title')
  const beforeEmit = view.state().workspace.draft.coordinator.editSeq
  view.emitContentChange()
  expect(view.state().workspace.draft.coordinator.editSeq).toBe(beforeEmit + 1)
  await advance(2000)
  const notices = texts(view.container, notice)
  expect(notices).toHaveLength(2)
  expect(notices.some(value => value.includes('Add a caption to each table.'))).toBe(true)
  expect(notices.some(value => value.includes('Connection failed.'))).toBe(true)
  expect(view.container.querySelector('.save-status')?.getAttribute('data-status'))
    .toBe('offline')
  expect(tableLocators()).toHaveLength(1)
  expect(tableLocators()[0]?.textContent).toContain('2 blocks')
  await advance(2000)
  expect(view.container.querySelector('.save-status')?.getAttribute('data-status'))
    .toBe('saved')
  expect(texts(view.container, `${notice} [data-publication-description]`))
    .toEqual(['Add a caption to each table.'])
  expect(tableLocators()).toHaveLength(1)
  expect(tableLocators()[0]?.textContent).toContain('2 blocks')
  expect(view.state().workspace.draft.rejection?.attempt).toBe(1)
  expect(view.stub.calls.filter(call => call.method === 'PUT')).toHaveLength(2)
})
