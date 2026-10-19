import type { z } from 'zod'
import { useRef, useState } from 'react'
import { historySchema } from '@/contracts/history'
import { get } from '@/shared/admin/api-client'

export type RevisionHistory = z.infer<typeof historySchema>

export function mergeRevisionHistory(old: RevisionHistory, page: RevisionHistory): RevisionHistory {
  const items = new Map(old.items.map(item => [item.revisionId, item]))
  for (const item of page.items) {
    items.set(item.revisionId, item)
  }
  return { ...page, items: Array.from(items.values()) }
}

export function useRevisionHistory(documentId: string): {
  history: RevisionHistory
  loaded: boolean
  loading: boolean
  error: string
  load: (older?: boolean) => Promise<void>
} {
  const [history, setHistory] = useState<RevisionHistory>({ items: [], nextBefore: null })
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const flightRef = useRef(false)
  const load = async (older = false): Promise<void> => {
    if (flightRef.current || (older && history.nextBefore === null)) {
      return
    }
    flightRef.current = true
    setLoading(true)
    setError('')
    try {
      const before = older ? `?before=${String(history.nextBefore)}` : ''
      const page = await get(`/api/admin/documents/${documentId}/revisions${before}`, historySchema)
      setHistory(old => older ? mergeRevisionHistory(old, page) : page)
      setLoaded(true)
    }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : 'CONNECTION_FAILED')
    }
    finally {
      flightRef.current = false
      setLoading(false)
    }
  }
  return { history, loaded, loading, error, load }
}
