import type { z } from 'zod'
import type { Document as ContentDocument } from '@/content/document'
import type { Acknowledgement, OpenDocument } from '@/contracts/documents'
import { validateDocument } from '@/content/document'
import { saveSchema } from '@/contracts/documents'
import {
  publishSchema,
  scheduleCancelSchema,
  scheduleItemSchema,
  unpublishSchema,
} from '@/contracts/publication'
import { timeChoices } from '@/server/publication/schedule-time'
import {
  editorWorkspaceDocument,
  tableBlock,
} from '~/tests/components/support/editor-workspace-fixtures'

/*
 * The declared HTTP boundary for the publication DOM cases: the real client
 * reads these replies, and a request with no declared route fails the case at
 * teardown instead of becoming an expected product failure.
 */

export type StubCall = {
  readonly method: string
  readonly path: string
  readonly query: URLSearchParams
  readonly body: unknown
  readonly headers: Record<string, string>
}

export type StubReply = { status?: number, body?: unknown } | 'disconnected'
export type StubRoute = (call: StubCall) => StubReply | Promise<StubReply>

export type Stub = {
  readonly calls: StubCall[]
  /** Requests no route answered; teardown fails the case on any entry. */
  readonly unhandled: string[]
  readonly restore: () => void
}

export type ScheduleItem = z.infer<typeof scheduleItemSchema>

/** The document and schedule rows the declared routes currently answer with. */
export type PublicationServer = {
  open: OpenDocument
  items: ScheduleItem[]
}

function requestPath(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.href
  }
  return input.url
}

function requestCall(input: RequestInfo | URL, init: RequestInit | undefined): StubCall {
  const url = new URL(requestPath(input), 'http://pilot.local')
  const packet = init?.body
  return {
    method: init?.method ?? 'GET',
    path: url.pathname,
    query: url.searchParams,
    body: typeof packet === 'string' ? JSON.parse(packet) as unknown : undefined,
    headers: Object.fromEntries(new Headers(init?.headers).entries()),
  }
}

const uuidPattern = /[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/gi

/** Route keys name the identifier slot while `calls` keep the request path. */
function routeKey(call: StubCall): string {
  return `${call.method} ${call.path.replace(uuidPattern, ':id')}`
}

/** One table of explicit replies for the real client; anything else fails. */
export function serveFetch(table: Readonly<Record<string, StubRoute>>): Stub {
  const calls: StubCall[] = []
  const unhandled: string[] = []
  const original = globalThis.fetch
  const handler: typeof fetch = async (input, init) => {
    const call = requestCall(input, init)
    calls.push(call)
    const route = table[routeKey(call)]
    if (route === undefined) {
      unhandled.push(routeKey(call))
      throw new TypeError(`The pilot has no reply for ${routeKey(call)}`)
    }
    const reply = await route(call)
    if (reply === 'disconnected') {
      throw new TypeError('connection lost')
    }
    return new Response(JSON.stringify(reply.body ?? {}), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  globalThis.fetch = handler
  return {
    calls,
    unhandled,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

export function deferred<T>(): { readonly promise: Promise<T>, readonly open: (value: T) => void } {
  let open: (value: T) => void = () => {}
  const promise = new Promise<T>((resolve) => {
    open = resolve
  })
  return { promise, open }
}

/** A JSON problem body, as the admin API reports a refused operation. */
export function failure(status: number, code: string, issues?: string[]): StubReply {
  return { status, body: issues === undefined ? { code } : { code, issues } }
}

export function publicationServer(
  initial: OpenDocument,
  items: ScheduleItem[] = [],
): PublicationServer {
  return { open: initial, items }
}

export function acknowledgementOf(open: OpenDocument): Acknowledgement {
  return {
    documentId: open.documentId,
    version: open.version,
    headRevisionId: open.headRevisionId,
    liveRevisionId: open.liveRevisionId,
    liveGeneration: open.liveGeneration,
  }
}

/** A saved document that another tab replaced while this editor stayed open. */
export function savedAhead(open: OpenDocument, title: string): OpenDocument {
  const next = structuredClone(open)
  next.version += 1
  next.headRevisionId = crypto.randomUUID()
  next.document.meta.title = title
  return next
}

/** The pending plan row a schedule list returns. */
export function publicationSchedule(
  open: OpenDocument,
  overrides: Partial<ScheduleItem> = {},
): ScheduleItem {
  const runAt = Date.now() + 86400000
  return scheduleItemSchema.parse({
    id: crypto.randomUUID(),
    revisionId: open.headRevisionId,
    state: 'pending',
    runAt,
    localTime: new Date(runAt).toISOString().slice(0, 16),
    timezone: 'UTC',
    utcOffset: 0,
    attempts: 0,
    nextAttemptAt: runAt,
    errorCode: null,
    createdAt: Date.now(),
    ...overrides,
  })
}

/** A saved draft that needs no schema repair before a rejection case. */
export function publicationDocument(
  title: string,
  configure?: (document: ContentDocument) => void,
): OpenDocument {
  return editorWorkspaceDocument(title, (document) => {
    document.meta.slug = `publication-dom-${crypto.randomUUID()}`
    configure?.(document)
  })
}

/** A valid envelope with two uncaptioned tables: issue count 2. */
export function twoTableDocument(title: string): OpenDocument {
  return publicationDocument(title, (document) => {
    document.blocks = [
      tableBlock(),
      tableBlock(),
    ]
  })
}

/** Five named problems: title, slug, table, empty media and image alt. */
export function incompleteDocument(): OpenDocument {
  return editorWorkspaceDocument('', (document) => {
    document.meta.title = ''
    document.meta.slug = ''
    document.blocks.unshift(tableBlock())
    const imageId = crypto.randomUUID()
    document.blocks.push({
      id: imageId,
      type: 'image',
      props: {
        url: '',
        name: '',
        caption: '',
        backgroundColor: 'default',
        textAlignment: 'left',
        showPreview: true,
      },
      children: [],
    })
    document.mediaAccessibility[imageId] = {
      alt: '',
      decorative: false,
      transcript: '',
      captionAssetId: null,
      posterAssetId: null,
    }
  })
}

/** The saved revision a successful revision write answers with. */
export function acceptSave(server: PublicationServer, call: StubCall): StubReply {
  const body = saveSchema.parse(call.body)
  if (
    body.expectedVersion !== server.open.version
    || body.baseRevisionId !== server.open.headRevisionId
  ) {
    return failure(409, 'EDIT_CONFLICT')
  }
  server.open = {
    ...server.open,
    version: body.expectedVersion + 1,
    headRevisionId: crypto.randomUUID(),
    document: validateDocument(body.document),
  }
  return { body: acknowledgementOf(server.open) }
}

/** The version-guarded publish or unpublish acknowledgement. */
export function acceptPublication(
  server: PublicationServer,
  call: StubCall,
  unpublish: boolean,
): StubReply {
  const body = unpublish ? unpublishSchema.parse(call.body) : publishSchema.parse(call.body)
  const revisionId = 'revisionId' in body ? body.revisionId : undefined
  if (
    body.expectedVersion !== server.open.version
    || body.expectedLiveGeneration !== server.open.liveGeneration
    || (!unpublish && revisionId !== server.open.headRevisionId)
  ) {
    return failure(409, 'EDIT_CONFLICT')
  }
  server.open = {
    ...server.open,
    version: body.expectedVersion + 1,
    liveGeneration: body.expectedLiveGeneration + 1,
    liveRevisionId: unpublish ? null : server.open.headRevisionId,
    livePath: unpublish ? null : `/posts/${server.open.document.meta.slug}`,
  }
  return { body: acknowledgementOf(server.open) }
}

/** Cancelling changes the plan and the document version, never the head. */
export function acceptCancel(server: PublicationServer, call: StubCall): StubReply {
  const body = scheduleCancelSchema.parse(call.body)
  if (body.expectedVersion !== server.open.version) {
    return failure(409, 'EDIT_CONFLICT')
  }
  server.items = server.items.map(item =>
    item.id === body.scheduleId ? { ...item, state: 'cancelled' as const } : item)
  server.open = { ...server.open, version: body.expectedVersion + 1 }
  return {
    body: {
      ...acknowledgementOf(server.open),
      scheduleId: body.scheduleId,
      state: 'cancelled',
    },
  }
}

/** The real timezone rule builds the explicit reply; the route stays declared. */
export function scheduleTimeReply(call: StubCall): StubReply {
  try {
    return {
      body: {
        choices: timeChoices(
          call.query.get('localTime') ?? '',
          call.query.get('timezone') ?? 'UTC',
        ),
      },
    }
  }
  catch {
    return failure(400, 'TIMEZONE_INVALID')
  }
}

export function publicationHandlers(
  server: PublicationServer,
  writes: Readonly<Record<string, StubRoute>> = {},
): Record<string, StubRoute> {
  return {
    'GET /api/admin/documents/:id': () => ({ body: server.open }),
    'GET /api/admin/documents/:id/schedule': () => ({ body: { items: server.items } }),
    'GET /api/admin/schedule-time': scheduleTimeReply,
    'PUT /api/admin/documents/:id/revisions': call => acceptSave(server, call),
    'POST /api/admin/documents/:id/publish': call => acceptPublication(server, call, false),
    'POST /api/admin/documents/:id/unpublish': call => acceptPublication(server, call, true),
    'DELETE /api/admin/documents/:id/schedule': call => acceptCancel(server, call),
    ...writes,
  }
}
