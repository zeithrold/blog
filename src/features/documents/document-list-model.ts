import type { DocumentFilters } from '@/content/document-list-query'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { documentListSchema } from '@/content/contracts'
import {
  defaultDocumentFilters,
  documentFiltersSchema,
  documentListPath,
} from '@/content/document-list-query'
import { APIError, Client, get } from '@/features/editor/services/api-client'

export type DocumentEntry = ReturnType<typeof documentListSchema.parse>['items'][number]
type Failure = 'load' | 'more' | 'article' | 'page' | 'restore' | null
export type DocumentsState = {
  entries: DocumentEntry[]
  cursor: string | null
  filters: DocumentFilters
  query: string
  loaded: boolean
  loading: 'list' | 'more' | null
  mutation: string | null
  error: Failure
  errorCode: string
  restored: boolean
}

export class DocumentsController {
  private readonly client: Client
  private readonly listeners = new Set<() => void>()
  private request = 0
  private lifetime = 0
  private failedEntry: DocumentEntry | null = null
  private state: DocumentsState = {
    entries: [],
    cursor: null,
    filters: defaultDocumentFilters,
    query: '',
    loaded: false,
    loading: 'list',
    mutation: null,
    error: null,
    errorCode: '',
    restored: false,
  }

  constructor(csrfToken: string) {
    this.client = new Client(csrfToken)
  }

  snapshot = (): DocumentsState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  cancel = (): void => {
    this.request++
    this.lifetime++
  }

  setQuery = (query: string): void => {
    this.update({ query })
  }

  private update(patch: Partial<DocumentsState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) {
      listener()
    }
  }

  async load(filters?: DocumentFilters): Promise<void> {
    const normalized = documentFiltersSchema.parse(filters ?? this.state.filters)
    const changed = JSON.stringify(normalized) !== JSON.stringify(this.state.filters)
    const request = ++this.request
    this.update({
      filters: normalized,
      query: filters === undefined ? this.state.query : normalized.q,
      entries: changed ? [] : this.state.entries,
      cursor: changed ? null : this.state.cursor,
      loaded: changed ? false : this.state.loaded,
      loading: 'list',
      error: null,
      errorCode: '',
      restored: false,
    })
    await this.fetchList(normalized, request)
  }

  private async fetchList(filters: DocumentFilters, request: number): Promise<void> {
    try {
      const result = await get(documentListPath(filters), documentListSchema)
      if (request === this.request) {
        this.update({ ...resultState(result), loaded: true, loading: null })
      }
    }
    catch (error) {
      if (request === this.request) {
        this.fail('load', error, { loading: null })
      }
    }
  }

  async more(): Promise<void> {
    const { cursor, filters, loading } = this.state
    if (cursor === null || loading !== null) {
      return
    }
    const request = ++this.request
    this.update({ loading: 'more', error: null, errorCode: '' })
    try {
      const result = await get(documentListPath(filters, cursor), documentListSchema)
      if (request === this.request) {
        this.update({
          entries: mergeEntries(this.state.entries, result.items),
          cursor: result.nextCursor,
          loading: null,
        })
      }
    }
    catch (error) {
      if (request === this.request) {
        this.fail('more', error, { loading: null })
      }
    }
  }

  async create(kind: 'article' | 'page'): Promise<void> {
    if (this.state.mutation !== null) {
      return
    }
    const lifetime = this.lifetime
    this.update({ mutation: kind, error: null, errorCode: '', restored: false })
    try {
      const ack = await this.client.write('/api/admin/documents', 'POST', { kind })
      if (lifetime === this.lifetime) {
        window.location.assign(`/admin/documents/${ack.documentId}`)
      }
    }
    catch (error) {
      if (lifetime === this.lifetime) {
        this.fail(kind, error, { mutation: null })
      }
    }
  }

  async restore(entry: DocumentEntry): Promise<void> {
    if (this.state.mutation !== null) {
      return
    }
    this.failedEntry = entry
    this.update({ mutation: entry.documentId, error: null, errorCode: '', restored: false })
    try {
      await this.client.write(`/api/admin/documents/${entry.documentId}/restore-deleted`, 'POST', {
        expectedVersion: entry.version,
      })
      this.failedEntry = null
      if (this.state.filters.state === 'deleted') {
        this.update({ entries: this.state.entries.filter(item => item.documentId !== entry.documentId) })
      }
      await this.load()
      this.update({ restored: true, mutation: null })
    }
    catch (error) {
      this.fail('restore', error, { mutation: null })
    }
  }

  async retry(): Promise<void> {
    const { error } = this.state
    if (this.state.errorCode === 'EDIT_CONFLICT') {
      await this.load()
    }
    else if (error === 'more') {
      await this.more()
    }
    else if (error === 'article' || error === 'page') {
      await this.create(error)
    }
    else if (error === 'restore' && this.failedEntry !== null) {
      await this.restore(this.failedEntry)
    }
    else {
      await this.load()
    }
  }

  private fail(error: Failure, cause: unknown, patch: Partial<DocumentsState>): void {
    this.update({
      ...patch,
      error,
      errorCode: mutationErrorCode(error, cause),
    })
  }
}

function mutationErrorCode(action: Failure, cause: unknown): string {
  const code = cause instanceof APIError ? cause.code : 'CONNECTION_FAILED'
  const unknown = !(cause instanceof APIError) || cause.status === 0 || cause.status >= 500
  if (unknown && code !== 'MAINTENANCE' && (action === 'restore' || action === 'article' || action === 'page')) {
    return 'MUTATION_OUTCOME_UNKNOWN'
  }
  return code
}

export function useDocuments(csrfToken: string): {
  controller: DocumentsController
  state: DocumentsState
} {
  const controller = useMemo(() => new DocumentsController(csrfToken), [csrfToken])
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  useEffect(() => {
    controller.load().catch(() => {})
    return controller.cancel
  }, [controller])
  return { controller, state }
}

export function documentPublication(entry: DocumentEntry): 'draft' | 'published' | 'changed' {
  if (entry.liveRevisionId === null) {
    return 'draft'
  }
  return entry.liveRevisionId === entry.headRevisionId ? 'published' : 'changed'
}

function resultState(result: ReturnType<typeof documentListSchema.parse>): {
  entries: DocumentEntry[]
  cursor: string | null
} {
  return { entries: result.items, cursor: result.nextCursor }
}

function mergeEntries(entries: DocumentEntry[], incoming: DocumentEntry[]): DocumentEntry[] {
  const known = new Set(entries.map(entry => entry.documentId))
  return [
    ...entries,
    ...incoming.filter(entry => !known.has(entry.documentId)),
  ]
}
