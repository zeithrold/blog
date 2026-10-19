import type { CatalogEntry, CatalogFields, CatalogKind } from '@/features/catalog/catalog-types'
import { catalogItemSchema, catalogListSchema } from '@/contracts/catalog'
import { acceptCatalogEntry, rebaseCatalogFields } from '@/features/catalog/catalog-form-state'
import { Client, get } from '@/shared/admin/api-client'
import { adminError } from '@/shared/admin/errors'

export type CatalogState = CatalogFields & {
  edit: CatalogEntry | null
  busy: boolean
  dirty: boolean
  error: string
  notice: string
  query: string
  data: { items: CatalogEntry[] } | null
  loading: boolean
  loadError: string
  updatedAt: number | null
}

function emptyState(): CatalogState {
  return {
    edit: null,
    name: '',
    slug: '',
    retired: false,
    busy: false,
    dirty: false,
    error: '',
    notice: '',
    query: '',
    data: null,
    loading: true,
    loadError: '',
    updatedAt: null,
  }
}

function isDirty(state: CatalogState): boolean {
  const base = state.edit ?? { name: '', slug: '', retired: false }
  return state.name !== base.name || state.slug !== base.slug || state.retired !== base.retired
}

export class CatalogSession {
  private client: Client
  private readonly initial = emptyState()
  private state = this.initial
  private readonly listeners = new Set<() => void>()
  private selection = 0
  private request = 0
  private listening = false
  private disposed = false
  private readonly lifetime = new AbortController()

  constructor(private readonly kind: CatalogKind, csrfToken: string, private readonly owner?: string) {
    this.client = new Client(csrfToken, owner)
  }

  snapshot = (): CatalogState => this.state
  serverSnapshot = (): CatalogState => this.initial
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setToken(csrfToken: string): void {
    this.client.csrfToken = csrfToken
  }

  setQuery = (query: string): void => this.update({ query })

  begin = (edit: CatalogEntry | null): void => {
    if (this.state.busy) {
      return
    }
    this.selection++
    this.client = new Client(this.client.csrfToken, this.owner)
    const { name = '', slug = '', retired = false } = edit ?? {}
    this.update({ edit, name, slug, retired, error: '', notice: '' })
  }

  change = <K extends keyof CatalogFields>(field: K, value: CatalogFields[K]): void => {
    if (!this.state.busy) {
      this.update({ [field]: value, notice: '' })
    }
  }

  refresh = async (): Promise<void> => {
    if (this.state.busy || this.disposed) {
      return
    }
    const request = ++this.request
    const selection = this.selection
    this.update({ loading: true, loadError: '' })
    try {
      const data = await get(`/api/admin/catalog/${this.kind}`, catalogListSchema, this.lifetime.signal)
      if (!this.currentRequest(request)) {
        return
      }
      this.update({ data, loading: false, updatedAt: Date.now() })
      const remote = data.items.find(item => item.id === this.state.edit?.id)
      if (remote !== undefined && this.state.edit !== null && selection === this.selection) {
        this.update({ ...rebaseCatalogFields(this.state, this.state.edit, remote), edit: remote, error: '' })
      }
    }
    catch {
      if (this.currentRequest(request)) {
        this.update({ loading: false, loadError: 'Unable to load data. Please retry.' })
      }
    }
  }

  save = async (): Promise<void> => {
    if (this.state.busy || !this.state.dirty || this.disposed) {
      return
    }
    const { edit, name, slug, retired } = this.state
    const path = `/api/admin/catalog/${this.kind}`
    this.selection++
    this.request++
    this.update({ busy: true, error: '', notice: '', loading: false })
    try {
      const saved = await this.client.mutate({
        path: edit === null ? path : `${path}/${edit.id}`,
        method: edit === null ? 'POST' : 'PUT',
        body: edit === null ? { name, slug } : { name, slug, retired, expectedVersion: edit.version },
        schema: catalogItemSchema,
        signal: this.lifetime.signal,
      })
      this.accept(saved, edit === null)
      await this.refresh()
    }
    catch (failure) {
      const error = adminError(failure, 'Unable to save the catalog entry. Your changes are kept in the form.')
      this.update({ busy: false, error })
    }
  }

  private accept(saved: CatalogEntry, created: boolean): void {
    this.selection++
    this.update({
      edit: null,
      name: '',
      slug: '',
      retired: false,
      busy: false,
      notice: created ? 'Catalog entry created.' : 'Catalog entry saved.',
      data: { items: acceptCatalogEntry(this.state.data?.items ?? [], saved) },
    })
  }

  private currentRequest(request: number): boolean {
    return request === this.request && !this.disposed
  }

  dispose(): void {
    this.disposed = true
    this.lifetime.abort()
    this.request++
    if (this.listening) {
      window.removeEventListener('beforeunload', this.warn)
    }
    this.listeners.clear()
  }

  private readonly warn = (event: BeforeUnloadEvent): void => event.preventDefault()

  private update(patch: Partial<CatalogState>): void {
    if (this.disposed) {
      return
    }
    const next = { ...this.state, ...patch }
    const dirty = isDirty(next)
    this.state = { ...next, dirty }
    if (typeof window !== 'undefined' && dirty !== this.listening) {
      window[dirty ? 'addEventListener' : 'removeEventListener']('beforeunload', this.warn)
      this.listening = dirty
    }
    for (const listener of this.listeners) {
      listener()
    }
  }
}

const sessions = new Map<CatalogKind, CatalogSession>()
let sessionOwner: string | null = null

export function catalogSession(owner: string, kind: CatalogKind, csrfToken: string): CatalogSession {
  // Server renders must never read or retain another request's form or credentials.
  if (typeof window === 'undefined') {
    return new CatalogSession(kind, csrfToken, owner)
  }
  if (sessionOwner !== owner) {
    for (const session of sessions.values()) {
      session.dispose()
    }
    sessions.clear()
    sessionOwner = owner
  }
  const session = sessions.get(kind) ?? new CatalogSession(kind, csrfToken, owner)
  session.setToken(csrfToken)
  sessions.set(kind, session)
  return session
}
