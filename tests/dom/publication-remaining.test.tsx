import type { MountedPublication } from './publication-remaining-support'
import type { StubReply } from './publication-stub'
import { act } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { validateDocument } from '@/content/document'
import { saveSchema } from '@/contracts/documents'
import { publishSchema, unpublishSchema } from '@/contracts/publication'
import {
  acceptSave,
  button,
  click,
  clickAndSettle,
  drainHostTask,
  failure,
  incompleteDocument,
  mountPublication,
  one,
  press,
  publicationDocument,
  publicationServer,
  resetDomPilot,
  savedAhead,
  text,
  texts,
  until,
} from './publication-remaining-support'

afterEach(() => {
  vi.useRealTimers()
  resetDomPilot()
})

type Action = 'publish' | 'unpublish'

function writeCalls(view: MountedPublication, route: string) {
  return view.stub.calls.filter(call => `${call.method} ${call.path}` === route)
}

function menuItem(label: string): HTMLElement | null {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .find(element => element.textContent.trim() === label) ?? null
}

async function runAction(view: MountedPublication, action: Action): Promise<void> {
  if (action === 'publish') {
    await clickAndSettle(view, one(view.container, '.editor-publish-action'))
    return
  }
  await act(async () => {
    press(one(view.container, 'button[aria-label="More document actions"]'), 'Enter')
    await drainHostTask()
  })
  await until(() => menuItem('Unpublish') !== null)
  const unpublish = menuItem('Unpublish')
  if (unpublish === null) {
    throw new Error('The document actions menu has no Unpublish item')
  }
  await act(async () => {
    click(unpublish)
    await drainHostTask()
  })
  await until(() => document.body.textContent.includes('Confirm'))
  await clickAndSettle(view, button(document.body, 'Confirm'))
  await drainHostTask()
}

function loadedFor(action: Action) {
  const loaded = publicationDocument('Publication conflict')
  if (action === 'unpublish') {
    loaded.liveRevisionId = loaded.headRevisionId
    loaded.liveGeneration = 1
    loaded.livePath = `/posts/${loaded.document.meta.slug}`
  }
  return loaded
}

for (const action of ['publish', 'unpublish'] as const) {
  it(`a clean tab resolves a ${action} conflict before retrying`, async () => {
    const loaded = loadedFor(action)
    const external = savedAhead(loaded, 'Latest saved title')
    const server = publicationServer(loaded)
    const route = `POST /api/admin/documents/${loaded.documentId}/${action}`
    const view = mountPublication({
      server,
      header: { livePath: () => server.open.livePath },
      writes: {
        [`POST /api/admin/documents/:id/${action}`]: () => failure(409, 'EDIT_CONFLICT'),
        'GET /api/admin/documents/:id': () => ({ body: external }),
      },
    })
    await view.load()
    server.open = external
    await runAction(view, action)
    const notice = '.editor-notice[data-tone="conflict"]'
    await until(() => view.container.querySelector(notice) !== null)
    expect(view.container.querySelectorAll(notice)).toHaveLength(1)
    expect(view.container.querySelector('.editor-notice[data-tone="error"]')).toBeNull()
    expect(text(view.container, `${notice} .editor-notice-description`))
      .toBe('This draft was updated elsewhere. Your local edits are preserved.')
    expect(view.container.querySelector('.save-status')?.getAttribute('data-status'))
      .toBe('conflict')
    expect(one<HTMLButtonElement>(view.container, '.editor-publish-action').disabled).toBe(true)

    act(() => {
      click(button(view.container, 'Compare changes'))
    })
    await until(() => view.container.querySelector('.conflict-comparison-summary') !== null)
    expect(text(view.container, '.conflict-comparison-summary'))
      .toBe(`The baseline is server version ${external.version}; the selected content is your local draft snapshot.`)
    expect(view.container.querySelector('[aria-label="Revision differences"]')).not.toBeNull()

    await clickAndSettle(
      view,
      one(view.container, 'button[aria-label="Use server version"]'),
    )
    expect(view.state().workspace.draft.localNotice)
      .toBe('Local recovery unavailable. Keep this tab open until a server save succeeds.')
    expect(view.state().workspace.draft.status).toBe('conflict')

    const attempts = writeCalls(view, route)
    expect(attempts).toHaveLength(1)
    const body = action === 'publish'
      ? publishSchema.parse(attempts[0]?.body)
      : unpublishSchema.parse(attempts[0]?.body)
    expect(body.expectedVersion).toBe(loaded.version)
    expect(body.expectedLiveGeneration).toBe(loaded.liveGeneration)
  })
}

const publicationIssues = [
  'title',
  'slug',
  'table',
  'mediaSource',
  'image',
] as const

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

for (const locale of ['en', 'zh'] as const) {
  it(`publication explains every rejection in ${locale === 'en' ? 'en' : 'zh-CN'}`, async () => {
    const open = incompleteDocument()
    const server = publicationServer(open)
    const view = mountPublication({
      server,
      locale: locale === 'zh' ? 'zh-CN' : 'en',
      header: { livePath: () => server.open.livePath },
      writes: {
        'POST /api/admin/documents/:id/publish': () =>
          failure(422, 'PUBLICATION_INVALID', [
            ...publicationIssues,
          ]),
      },
    })
    await view.load()
    await clickAndSettle(view, one(view.container, '.editor-publish-action'))

    const notice = '.editor-notice[data-tone="error"]'
    await until(() => view.container.querySelector(notice) !== null)
    expect(view.container.querySelectorAll(notice)).toHaveLength(1)
    expect(text(view.container, `${notice} h2`)).toBe(rejectionHeading[locale])
    expect(texts(view.container, `${notice} [data-publication-description]`))
      .toEqual(issueText[locale])
    const rendered = view.container.querySelector(notice)?.textContent ?? ''
    expect(rendered).not.toContain('PUBLICATION_INVALID')
    expect(rendered).not.toContain('INVALID_DOCUMENT')

    const attempts = writeCalls(view, `POST /api/admin/documents/${open.documentId}/publish`)
    expect(attempts).toHaveLength(1)
    expect(publishSchema.parse(attempts[0]?.body)).toEqual({
      expectedVersion: open.version,
      expectedLiveGeneration: open.liveGeneration,
      revisionId: open.headRevisionId,
    })
  })
}

it('a refused publication renders its server error heading', async () => {
  const open = publicationDocument('Server-only reason')
  const server = publicationServer(open)
  const view = mountPublication({
    server,
    header: { livePath: () => server.open.livePath },
    writes: {
      'POST /api/admin/documents/:id/publish': () => failure(422, 'PUBLICATION_INVALID', ['image']),
    },
  })
  await view.load()
  await clickAndSettle(view, one(view.container, '.editor-publish-action'))
  const notice = '.editor-notice[data-tone="error"]'
  await until(() => view.container.querySelector(notice) !== null)
  expect(text(view.container, `${notice} h2`)).toBe('Publication checks failed')
  expect(texts(view.container, `${notice} [data-publication-description]`))
    .toEqual(['Add image alternative text or mark the image as decorative.'])
  expect(view.container.querySelectorAll(`${notice} button`)).toHaveLength(0)
})

const saveFailures = [
  {
    status: 413,
    code: 'DOCUMENT_TOO_LARGE',
    message: 'The document exceeds the size limit. Shorten the content or split it '
      + 'into multiple documents, then save again.',
    saveStatus: 'error',
  },
  {
    status: 422,
    code: 'INVALID_DOCUMENT',
    message: 'The document failed validation. Check required fields, references and media settings, then retry.',
    saveStatus: 'error',
  },
  {
    status: 0,
    code: 'CONNECTION_FAILED',
    message: 'Connection failed. Your local changes are kept; retry when connected.',
    saveStatus: 'offline',
  },
] as const

for (const failureCase of saveFailures) {
  it(`publishing retains the save failure reason ${failureCase.code} and permits correction`, async () => {
    let failSaves = true
    let savedHead: string | undefined
    const server = publicationServer(publicationDocument('Save failure'))
    const view = mountPublication({
      server,
      header: { livePath: () => server.open.livePath },
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
    view.editTitle('Changed draft')
    const publish = one(view.container, '.editor-publish-action')
    await clickAndSettle(view, publish)
    const notice = '.editor-notice[data-tone="error"]'
    expect(view.container.querySelector(notice)?.textContent).toContain(failureCase.message)
    expect(view.container.querySelector('.save-status')?.getAttribute('data-status'))
      .toBe(failureCase.saveStatus)
    const publishRoute = `POST /api/admin/documents/${server.open.documentId}/publish`
    const saveRoute = `PUT /api/admin/documents/${server.open.documentId}/revisions`
    expect(writeCalls(view, publishRoute)).toHaveLength(0)
    expect(writeCalls(view, saveRoute)).toHaveLength(1)

    await clickAndSettle(view, publish)
    expect(view.container.querySelector(notice)?.textContent).toContain(failureCase.message)
    expect(view.container.querySelector(notice)?.textContent).not.toContain('Wait for the draft')
    expect(writeCalls(view, publishRoute)).toHaveLength(0)
    expect(writeCalls(view, saveRoute)).toHaveLength(failureCase.status === 0 ? 2 : 1)

    failSaves = false
    view.editTitle('Corrected draft')
    await clickAndSettle(view, publish)
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
