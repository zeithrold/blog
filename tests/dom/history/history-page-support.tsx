import type { Document } from '@/content/document'
import type { Acknowledgement, OpenDocument } from '@/contracts/documents'
import type { History, HistoryModel, HistoryPageProps } from '@/features/history/history-page-model'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect } from 'vitest'
import { emptyDocument } from '@/content/document'
import { acknowledgementSchema, openDocumentSchema } from '@/contracts/documents'
import { historySchema } from '@/contracts/history'
import { useHistoryPage } from '@/features/history/history-page-model'

/**
 * Support for the DOM pilot: fixtures, an explicit HTTP table and a real mount.
 *
 * Only `fetch` is replaced. The hook, its state and refs, the client's
 * idempotency keys and the Zod schemas all run as they do in the browser.
 */

export const sha256 = '0'.repeat(64)

const documentId = '11111111-1111-4111-8111-111111111111'
const createdId = '22222222-2222-4222-8222-222222222222'
const firstId = '33333333-3333-4333-8333-333333333333'
const latestId = '44444444-4444-4444-8444-444444444444'
const externalId = '55555555-5555-4555-8555-555555555555'
const restoredId = '66666666-6666-4666-8666-666666666666'

/** One stored revision: the history item the page lists and the document behind it. */
export type StoredRevision = {
  readonly revisionId: string
  readonly sequence: number
  readonly reason: 'create' | 'manual' | 'restore'
  readonly createdAt: number
  readonly document: Document
}

export type HistoryFixture = {
  readonly path: string
  readonly initial: OpenDocument
  readonly history: History
  /** Newest first, as the history list returns them. */
  readonly stored: readonly StoredRevision[]
  readonly created: StoredRevision
  readonly first: StoredRevision
  readonly latest: StoredRevision
}

function titled(source: Document, title: string): Document {
  return { ...source, meta: { ...source.meta, title } }
}

function storedDocument(title: string, slug: string, body: string): Document {
  const value = titled(emptyDocument(), title)
  value.meta.slug = slug
  const block = value.blocks[0]
  if (block !== undefined) {
    block.content = [
      { type: 'text', text: body, styles: {} },
    ]
  }
  return value
}

export function historyOf(stored: readonly StoredRevision[]): History {
  return historySchema.parse({
    items: stored.map(item => ({
      revisionId: item.revisionId,
      sequence: item.sequence,
      reason: item.reason,
      createdAt: item.createdAt,
      restoredFromId: null,
      contentSha256: sha256,
    })),
    nextBefore: null,
  })
}

/** A document created empty and saved twice: the smallest history worth comparing. */
export function historyCase(): HistoryFixture {
  const created: StoredRevision = {
    revisionId: createdId,
    sequence: 1,
    reason: 'create',
    createdAt: Date.UTC(2026, 0, 2, 9, 1),
    document: emptyDocument(),
  }
  const first: StoredRevision = {
    revisionId: firstId,
    sequence: 2,
    reason: 'manual',
    createdAt: Date.UTC(2026, 0, 2, 9, 2),
    document: storedDocument('First historical title', 'history-first', 'First historical body'),
  }
  const latest: StoredRevision = {
    revisionId: latestId,
    sequence: 3,
    reason: 'manual',
    createdAt: Date.UTC(2026, 0, 2, 9, 3),
    document: storedDocument('Latest draft title', 'history-latest', 'Latest draft body'),
  }
  const stored = [
    latest,
    first,
    created,
  ]
  const initial = openDocumentSchema.parse({
    documentId,
    kind: 'article',
    version: 4,
    headRevisionId: latest.revisionId,
    liveRevisionId: first.revisionId,
    liveGeneration: 0,
    livePath: '/posts/history-first',
    document: latest.document,
  })
  return {
    path: `/api/admin/documents/${documentId}`,
    initial,
    history: historyOf(stored),
    stored,
    created,
    first,
    latest,
  }
}

/** The server state after another writer saved a newer head the page has not seen. */
export function savedElsewhere(fixture: HistoryFixture, title: string): {
  readonly revision: StoredRevision
  readonly initial: OpenDocument
  readonly history: History
} {
  const revision: StoredRevision = {
    revisionId: externalId,
    sequence: 4,
    reason: 'manual',
    createdAt: Date.UTC(2026, 0, 3),
    document: titled(fixture.latest.document, title),
  }
  return {
    revision,
    initial: openDocumentSchema.parse({
      ...fixture.initial,
      version: fixture.initial.version + 1,
      headRevisionId: revision.revisionId,
      document: revision.document,
    }),
    history: historyOf([
      revision,
      ...fixture.stored,
    ]),
  }
}

/** The head revision a confirmed restore records. */
export function restoredRevision(fixture: HistoryFixture): StoredRevision {
  return {
    revisionId: restoredId,
    sequence: 4,
    reason: 'restore',
    createdAt: Date.UTC(2026, 0, 3),
    document: fixture.first.document,
  }
}

/** The served document after a confirmed restore of one revision. */
export function restoredDocument(
  fixture: HistoryFixture,
  restored: StoredRevision,
): OpenDocument {
  return restoredOn(fixture.initial, restored)
}

/** The served document after a confirmed restore, over the state it replaced. */
export function restoredOn(served: OpenDocument, restored: StoredRevision): OpenDocument {
  return openDocumentSchema.parse({
    ...served,
    version: served.version + 1,
    headRevisionId: restored.revisionId,
    document: restored.document,
  })
}

export function acknowledged(
  fixture: HistoryFixture,
  overrides: Partial<Acknowledgement> = {},
): Acknowledgement {
  return acknowledgementSchema.parse({
    documentId,
    version: fixture.initial.version + 1,
    headRevisionId: fixture.initial.headRevisionId,
    liveRevisionId: fixture.initial.liveRevisionId,
    liveGeneration: fixture.initial.liveGeneration,
    ...overrides,
  })
}

export function readRevision(revision: StoredRevision): { body: unknown } {
  return { body: { revisionId: revision.revisionId, contentSha256: sha256, document: revision.document } }
}

export type StubCall = {
  readonly method: string
  readonly path: string
  readonly body: unknown
  readonly headers: Record<string, string>
}

export type StubReply = { readonly status?: number, readonly body?: unknown } | 'disconnected'
export type StubRoute = (call: StubCall) => StubReply | Promise<StubReply>

export type Stub = {
  readonly calls: StubCall[]
  /**
   * Requests no route answered. The teardown fails the case on any entry, so a
   * product `catch` cannot turn a missing reply into an expected failure.
   */
  readonly unhandled: string[]
  readonly restore: () => void
}

/** A JSON problem body, as the admin API reports a refused operation. */
export function failure(status: number, code: string): StubReply {
  return { status, body: { code } }
}

function requestPath(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.pathname
  }
  return input.url
}

function requestCall(input: RequestInfo | URL, init: RequestInit | undefined): StubCall {
  const packet = init?.body
  return {
    method: init?.method ?? 'GET',
    path: requestPath(input),
    body: typeof packet === 'string' ? JSON.parse(packet) as unknown : undefined,
    headers: Object.fromEntries(new Headers(init?.headers).entries()),
  }
}

const served: Stub[] = []

/** The HTTP boundary: one table of explicit replies for the real client to read. */
export function serveFetch(table: Record<string, StubRoute>): Stub {
  const calls: StubCall[] = []
  const unhandled: string[] = []
  const original = globalThis.fetch
  const stub: Stub = {
    calls,
    unhandled,
    restore: () => { globalThis.fetch = original },
  }
  const handler: typeof fetch = async (input, init) => {
    const call = requestCall(input, init)
    calls.push(call)
    const route = table[`${call.method} ${call.path}`]
    if (route === undefined) {
      unhandled.push(`${call.method} ${call.path}`)
      throw new TypeError(`The pilot has no reply for ${call.method} ${call.path}`)
    }
    const reply = await route(call)
    if (reply === 'disconnected') {
      // The server may or may not have committed; the browser learns nothing.
      throw new TypeError('connection lost')
    }
    return new Response(JSON.stringify(reply.body ?? {}), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  globalThis.fetch = handler
  served.push(stub)
  return stub
}

export type Mounted = {
  readonly model: () => HistoryModel
  readonly unmount: () => void
}

const mounted: Mounted[] = []

/** Mounts the real hook and returns the model of its latest committed render. */
export function mountHistory(props: HistoryPageProps): Mounted {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  let latest: HistoryModel | null = null
  function Probe({ value }: { value: HistoryPageProps }): null {
    latest = useHistoryPage(value)
    return null
  }
  act(() => {
    root.render(<Probe value={props} />)
  })
  const view: Mounted = {
    model: () => {
      if (latest === null) {
        throw new Error('The history page model never rendered')
      }
      return latest
    },
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
  mounted.push(view)
  return view
}

export function page(fixture: HistoryFixture): HistoryPageProps {
  return { initial: fixture.initial, history: fixture.history, csrfToken: 'pilot-csrf-token' }
}

export function writes(stub: Stub): StubCall[] {
  return stub.calls.filter(call => call.method === 'POST')
}

export function requestLines(stub: Stub): string[] {
  return stub.calls.map(call => `${call.method} ${call.path}`)
}

/** Unmounts, restores `fetch` and fails on any request the case did not serve. */
export function resetDomPilot(): void {
  try {
    for (const view of mounted.splice(0)) {
      view.unmount()
    }
  }
  finally {
    const stubs = served.splice(0)
    for (const stub of stubs) {
      stub.restore()
    }
    for (const stub of stubs) {
      expect(stub.unhandled).toEqual([])
    }
  }
}
