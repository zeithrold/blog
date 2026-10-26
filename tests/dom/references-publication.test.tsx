import type { ApiHandler } from './http'
import type { StubRoute } from './publication-stub'
import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { button, click, one } from './dom'
import { until } from './environment'
import { defer } from './http'
import { publicationDocument, publicationHandlers, publicationServer } from './publication-stub'
import {
  mountReferences,
  openReferenceList,
  resetReferences,
} from './references-support'

afterEach(resetReferences)

function apiHandlers(routes: Readonly<Record<string, StubRoute>>): Record<string, ApiHandler> {
  const handlers: Record<string, ApiHandler> = {}
  for (const [key, route] of Object.entries(routes)) {
    handlers[key] = async (call) => {
      const reply = await route({
        method: call.method,
        path: call.path,
        query: call.query,
        body: call.json,
        headers: call.headers,
      })
      return reply === 'disconnected' ? { abort: 'failed' } : reply
    }
  }
  return handlers
}

function holdPublicationReply(
  server: ReturnType<typeof publicationServer>,
  started: ReturnType<typeof defer>,
  held: ReturnType<typeof defer>,
): Record<string, ApiHandler> {
  const handlers = apiHandlers(publicationHandlers(server))
  const publish = handlers['POST /api/admin/documents/:id/publish']
  if (publish === undefined) {
    throw new Error('Publication fixture omitted its publish route')
  }
  handlers['POST /api/admin/documents/:id/publish'] = async (call) => {
    started.open()
    await held.promise
    return await publish(call)
  }
  return handlers
}

it('locks reference mutations while publishing and unlocks them after the response', async () => {
  const open = publicationDocument('Reference publication', (document) => {
    document.meta.slug = 'reference-publication'
    document.references = [
      {
        id: crypto.randomUUID(),
        title: 'Unused reference',
        authors: ['Author'],
        year: null,
        url: '',
        doi: '',
      },
    ]
  })
  const server = publicationServer(open)
  const held = defer()
  const started = defer()
  const handlers = holdPublicationReply(server, started, held)
  const view = mountReferences({
    initial: open,
    handlers,
    publication: server,
  })
  try {
    await act(async () => await view.api.settle())
    openReferenceList(view)
    const list = one(view.container, '.reference-settings')
    const add = button(list, 'Add reference')
    expect(add.disabled).toBe(false)
    const edit = one<HTMLButtonElement>(list, 'button[aria-label="Edit reference: Unused reference"]')
    const remove = one<HTMLButtonElement>(list, 'button[aria-label="Remove reference: Unused reference"]')
    expect(edit.disabled).toBe(false)
    expect(remove.disabled).toBe(false)

    act(() => click(one(view.container, 'button.editor-publish-action')))
    await started.promise
    expect(add.disabled).toBe(true)
    expect(edit.disabled).toBe(true)
    expect(remove.disabled).toBe(true)

    await act(async () => {
      held.open()
      await view.api.settle()
    })
    await view.api.expectServed()
    await until(() => add.disabled === false && view.container.querySelector('a.editor-live-link') !== null)
    expect(add.disabled).toBe(false)
    expect(edit.disabled).toBe(false)
    expect(remove.disabled).toBe(false)
    // This DOM surface supplies the fixture's livePath to PublicationHeader; it
    // proves anchor presentation only, not the production useLivePath read chain.
    expect(one<HTMLAnchorElement>(view.container, 'a.editor-live-link').getAttribute('href'))
      .toBe('/posts/reference-publication')
  }
  finally {
    held.open()
    await act(async () => await view.api.settle())
  }
})
