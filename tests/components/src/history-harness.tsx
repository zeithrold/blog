'use client'
import type { ReactNode } from 'react'
import type { OpenDocument } from '@/contracts/documents'
import type { History } from '@/features/history/history-page-model'
import { useEffect, useState } from 'react'
import { openDocumentSchema } from '@/contracts/documents'
import { historySchema } from '@/contracts/history'
import { HistoryPage } from '@/features/history/history-page'
import { get } from '@/shared/admin/api-client'

/**
 * The history route is a server component: it hands `HistoryPage` the opened
 * document, its history page and the session token. The harness asks the case's
 * HTTP table for the same two documents through the real client and schemas, then
 * mounts the unmodified page with them.
 *
 * The bootstrap id is arbitrary. A fixture handler is keyed by route, not by one
 * run's UUID, and every later request follows the id of the document it served.
 */
const bootstrapId = '00000000-0000-4000-8000-000000000000'

type Loaded = { initial: OpenDocument, history: History }

export function HistoryHarness({ csrfToken }: { csrfToken: string }): ReactNode {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failure, setFailure] = useState('')
  useEffect(() => {
    const path = `/api/admin/documents/${bootstrapId}`
    const load = async (): Promise<Loaded> => ({
      initial: await get(path, openDocumentSchema),
      history: await get(`${path}/revisions`, historySchema),
    })
    load().then(setLoaded, (error: unknown) => {
      setFailure(error instanceof Error ? error.message : 'CONNECTION_FAILED')
    })
  }, [])
  if (failure !== '') {
    return <p data-history-bootstrap="failed" role="alert">{`History bootstrap failed: ${failure}`}</p>
  }
  if (loaded === null) {
    return <p data-history-bootstrap="loading" />
  }
  return <HistoryPage initial={loaded.initial} history={loaded.history} csrfToken={csrfToken} />
}
