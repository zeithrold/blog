'use client'
import type { CatalogState } from '@/features/catalog/catalog-session'
import type { CatalogEntry } from '@/features/catalog/catalog-types'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { catalogSession } from '@/features/catalog/catalog-session'

export type { CatalogEntry }

type CatalogManagerModel = CatalogState & {
  resource: Pick<CatalogState, 'data' | 'loading' | 'updatedAt'> & { error: string, refresh: () => Promise<void> }
  begin: (entry: CatalogEntry | null) => void
  setName: (value: string) => void
  setSlug: (value: string) => void
  setRetired: (value: boolean) => void
  setQuery: (value: string) => void
  save: () => Promise<void>
  refresh: () => Promise<void>
}

export function useCatalogManager(kind: 'tag' | 'series', csrfToken: string, owner: string): CatalogManagerModel {
  const session = useMemo(() => catalogSession(owner, kind, csrfToken), [
    owner,
    kind,
    csrfToken,
  ])
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.serverSnapshot)
  useEffect(() => {
    session.refresh().catch(() => {})
  }, [session])
  return {
    ...state,
    resource: {
      data: state.data,
      loading: state.loading,
      error: state.loadError,
      updatedAt: state.updatedAt,
      refresh: session.refresh,
    },
    begin: session.begin,
    setName: (value: string) => session.change('name', value),
    setSlug: (value: string) => session.change('slug', value),
    setRetired: (value: boolean) => session.change('retired', value),
    setQuery: session.setQuery,
    save: session.save,
    refresh: session.refresh,
  }
}
