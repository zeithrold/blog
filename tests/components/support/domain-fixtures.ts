import type { ApiCall, ApiReply } from '~/tests/components/support/http-fixtures'
import { catalogItemSchema, catalogListSchema } from '@/contracts/catalog'
import { acknowledgementSchema, documentListSchema } from '@/contracts/documents'

/**
 * Domain data for the component browser specs.
 *
 * Bodies are built through the application's own schemas: a fixture cannot
 * describe a document or catalog entry the product would reject, and a spec that
 * changes a contract field fails here instead of rendering an untested shape.
 */
export type DocumentEntry = ReturnType<typeof documentListSchema.parse>['items'][number]
export type DocumentPage = ReturnType<typeof documentListSchema.parse>
export type CatalogEntry = ReturnType<typeof catalogItemSchema.parse>
export type CatalogPage = ReturnType<typeof catalogListSchema.parse>
export type Acknowledgement = ReturnType<typeof acknowledgementSchema.parse>

export function documentEntry(overrides: Partial<DocumentEntry> = {}): DocumentEntry {
  return {
    documentId: crypto.randomUUID(),
    kind: 'article',
    title: 'Fixture document',
    version: 1,
    headRevisionId: crypto.randomUUID(),
    liveRevisionId: null,
    updatedAt: Date.UTC(2026, 0, 12),
    ...overrides,
  }
}

/** An entry whose live revision is its head, which the list renders as published. */
export function publishedEntry(overrides: Partial<DocumentEntry> = {}): DocumentEntry {
  const headRevisionId = overrides.headRevisionId ?? crypto.randomUUID()
  return documentEntry({ headRevisionId, liveRevisionId: headRevisionId, ...overrides })
}

/** Validated through `documentListSchema`, so the page matches the served contract. */
export function documentsPage(
  items: readonly DocumentEntry[],
  nextCursor: string | null = null,
): DocumentPage {
  return documentListSchema.parse({ items, nextCursor })
}

export function acknowledgementFor(
  entry: DocumentEntry,
  overrides: Partial<Acknowledgement> = {},
): Acknowledgement {
  return acknowledgementSchema.parse({
    documentId: entry.documentId,
    version: entry.version,
    headRevisionId: entry.headRevisionId,
    liveRevisionId: entry.liveRevisionId,
    liveGeneration: 0,
    ...overrides,
  })
}

export function catalogEntry(input: {
  kind: 'tag' | 'series'
  name: string
  slug: string
  retired?: boolean
  version?: number
  id?: string
}): CatalogEntry {
  return catalogItemSchema.parse({
    id: input.id ?? crypto.randomUUID(),
    kind: input.kind,
    slug: input.slug,
    name: input.name,
    version: input.version ?? 0,
    retired: input.retired ?? false,
  })
}

export function catalogPage(items: readonly CatalogEntry[]): CatalogPage {
  return catalogListSchema.parse({ items })
}

/** The list filters the component serializes into its query string. */
export type DocumentQuery = {
  readonly q: string
  readonly kind: string
  readonly state: string
  readonly cursor: string | null
}

export function documentFilters(query: URLSearchParams): DocumentQuery {
  return {
    q: query.get('q') ?? '',
    kind: query.get('kind') ?? 'all',
    state: query.get('state') ?? 'all',
    cursor: query.get('cursor'),
  }
}

/**
 * Fixture-side selection for the list endpoint: the subset a real query would
 * return for the entries this case stored. `state=deleted` keeps the rows as
 * given, because delete-ness is not part of a listed entry; trash cases hold
 * their own deleted row set.
 */
export function selectDocuments(
  entries: readonly DocumentEntry[],
  call: ApiCall,
  nextCursor: string | null = null,
): ApiReply {
  const filter = documentFilters(call.query)
  return { body: documentsPage(entries.filter(entry => matchesEntry(entry, filter)), nextCursor) }
}

function matchesEntry(entry: DocumentEntry, filter: DocumentQuery): boolean {
  if (filter.q !== '' && !entry.title.toLowerCase().includes(filter.q.toLowerCase())) {
    return false
  }
  if (filter.kind !== 'all' && entry.kind !== filter.kind) {
    return false
  }
  if (filter.state === 'draft') {
    return entry.liveRevisionId === null
  }
  if (filter.state === 'published') {
    return entry.liveRevisionId === entry.headRevisionId
  }
  if (filter.state === 'changed') {
    return entry.liveRevisionId !== null && entry.liveRevisionId !== entry.headRevisionId
  }
  return true
}
