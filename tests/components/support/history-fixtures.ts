import type { Document } from '@/content/document'
import type { Acknowledgement, OpenDocument } from '@/contracts/documents'
import type { History } from '@/features/history/history-page-model'
import type { ApiCall, ApiHandler, ApiReply } from '~/tests/components/support/http-fixtures'
import { emptyDocument } from '@/content/document'
import { acknowledgementSchema, openDocumentSchema } from '@/contracts/documents'
import { historySchema } from '@/contracts/history'

/** One stored revision: the history item the page lists and the document behind it. */
export type HistoryRevision = {
  readonly revisionId: string
  readonly sequence: number
  readonly reason: 'create' | 'manual' | 'restore'
  readonly createdAt: number
  readonly document: Document
}

/** The stored document set a history case starts from. */
export type HistoryCase = {
  readonly path: string
  readonly initial: OpenDocument
  readonly history: History
  readonly created: HistoryRevision
  readonly first: HistoryRevision
  readonly latest: HistoryRevision
}

/** Server state after another tab saved a revision the page has not seen yet. */
export type HistorySave = {
  readonly initial: OpenDocument
  readonly history: History
  readonly revision: HistoryRevision
}

const sha256 = '0'.repeat(64)

/**
 * A document created empty, saved once and published, then saved again: the
 * smallest history the page can compare, restore and publish from.
 *
 * Every body is built through the product's own schemas, so a fixture cannot
 * describe a document or a history page the API would refuse.
 */
export function historyCase(overrides: {
  readonly title?: string
  readonly slug?: string
  readonly body?: string
  readonly latestTitle?: string
  readonly latestBody?: string
} = {}): HistoryCase {
  const slug = overrides.slug ?? `history-${crypto.randomUUID()}`
  const created = revision(1, 'create', emptyDocument())
  const first = revision(2, 'manual', document(
    overrides.title ?? 'First historical title',
    slug,
    overrides.body ?? 'First historical body',
  ))
  const latest = revision(3, 'manual', document(
    overrides.latestTitle ?? 'Latest draft title',
    `${slug}-updated`,
    overrides.latestBody ?? 'Latest draft body',
  ))
  const initial = openDocumentValue({
    documentId: crypto.randomUUID(),
    kind: 'article',
    version: 4,
    headRevisionId: latest.revisionId,
    liveRevisionId: first.revisionId,
    liveGeneration: 0,
    livePath: `/posts/${slug}`,
    document: latest.document,
  })
  return {
    path: `/api/admin/documents/${initial.documentId}`,
    initial,
    history: historyOf([
      latest,
      first,
      created,
    ], null),
    created,
    first,
    latest,
  }
}

/** The page's mount reads and revision reads, answered from this case's documents. */
export function historyReads(value: HistoryCase): Record<string, ApiHandler> {
  return {
    'GET /api/admin/documents/:id': () => ({ body: value.initial }),
    'GET /api/admin/documents/:id/revisions': () => ({ body: value.history }),
    'GET /api/admin/documents/:id/revisions/:id': call => storedRevision(value, call),
  }
}

/** `GET .../revisions/:id` answers the document stored behind the requested revision. */
export function storedRevision(value: HistoryCase, call: ApiCall): ApiReply {
  const requested = call.path.slice(call.path.lastIndexOf('/') + 1)
  const known = [
    value.created,
    value.first,
    value.latest,
  ].find(item => item.revisionId === requested)
  if (known === undefined) {
    throw new Error(`The history page asked for an unknown revision ${requested}`)
  }
  return { body: { revisionId: known.revisionId, contentSha256: sha256, document: known.document } }
}

/** The acknowledgement a confirmed restore or publish returns. */
export function historyAcknowledgement(
  value: HistoryCase,
  overrides: Partial<Acknowledgement> = {},
): Acknowledgement {
  return acknowledgementSchema.parse({
    documentId: value.initial.documentId,
    version: value.initial.version + 1,
    headRevisionId: value.initial.headRevisionId,
    liveRevisionId: value.initial.liveRevisionId,
    liveGeneration: value.initial.liveGeneration,
    ...overrides,
  })
}

/** The served document after the case's own server state changed. */
export function openDocument(value: HistoryCase, overrides: Partial<OpenDocument>): OpenDocument {
  return openDocumentValue({ ...value.initial, ...overrides })
}

/** A new head revision, as a confirmed restore records one. */
export function restoredHead(value: HistoryCase, source: HistoryRevision): HistoryRevision {
  return restoredInto(value.history, source)
}

/** A new head revision for a history list that has already grown. */
export function restoredInto(value: History, source: HistoryRevision): HistoryRevision {
  return {
    ...source,
    revisionId: crypto.randomUUID(),
    sequence: value.items.length + 1,
    reason: 'restore',
    createdAt: Date.UTC(2026, 0, 3),
  }
}

/** The history list with one newer revision on top. */
export function appendedHistory(value: History, entry: HistoryRevision): History {
  return historySchema.parse({
    items: [
      historyItem(entry),
      ...value.items,
    ],
    nextBefore: value.nextBefore,
  })
}

/** A revision another tab saved: the server state and the history item it added. */
export function savedElsewhere(value: HistoryCase, title: string): HistorySave {
  const saved = {
    ...restoredHead(value, value.latest),
    reason: 'manual' as const,
    document: titled(value.latest.document, title),
  }
  return {
    revision: saved,
    initial: openDocument(value, {
      version: value.initial.version + 1,
      headRevisionId: saved.revisionId,
      document: saved.document,
    }),
    history: appendedHistory(value.history, saved),
  }
}

function revision(sequence: number, reason: HistoryRevision['reason'], value: Document): HistoryRevision {
  return {
    revisionId: crypto.randomUUID(),
    sequence,
    reason,
    createdAt: Date.UTC(2026, 0, 2, 9, sequence),
    document: value,
  }
}

function document(title: string, slug: string, body: string): Document {
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

function titled(value: Document, title: string): Document {
  return { ...value, meta: { ...value.meta, title } }
}

function openDocumentValue(input: OpenDocument): OpenDocument {
  return openDocumentSchema.parse(input)
}

function historyOf(items: readonly HistoryRevision[], nextBefore: number | null): History {
  return historySchema.parse({ items: items.map(item => historyItem(item)), nextBefore })
}

function historyItem(item: HistoryRevision): History['items'][number] {
  return {
    revisionId: item.revisionId,
    sequence: item.sequence,
    reason: item.reason,
    createdAt: item.createdAt,
    restoredFromId: null,
    contentSha256: sha256,
  }
}
