import type { Document } from '@/content/document'
import type { PublicationIssue } from '@/content/publication-issues'
import type { Acknowledgement, OpenDocument } from '@/contracts/documents'
import { useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { UUID, validateDocument } from '@/content/document'
import { publicationPath } from '@/content/publication-path'
import { openDocumentSchema } from '@/contracts/documents'
import { historySchema } from '@/contracts/history'
import { APIError, Client, get } from '@/shared/admin/api-client'

const revisionSchema = z.strictObject({
  revisionId: UUID,
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  document: z.unknown().transform(input => validateDocument(input)),
})
export type History = z.infer<typeof historySchema>
export type SavedRevision = {
  revisionId: string
  document: Document
}

export type HistoryPageProps = {
  initial: OpenDocument
  history: History
  csrfToken: string
}

export type HistoryAction = 'restore' | 'publish'
export type HistoryModel = {
  current: OpenDocument
  history: History
  baseline: SavedRevision
  selected: SavedRevision
  busy: boolean
  loading: boolean
  /** Only a refusal that needs review in place; successes are announced by the page. */
  notice: 'conflict' | null
  error: string
  errorIssues: PublicationIssue[]
  refreshRequired: boolean
  choose: (id: string, side: 'baseline' | 'selected') => Promise<void>
  more: () => Promise<void>
  refresh: () => Promise<void>
  /** Resolves `true` only when the server confirmed the action. */
  perform: (action: HistoryAction) => Promise<boolean>
}

export function useHistoryPage(props: HistoryPageProps): HistoryModel {
  const state = useHistoryState(props)
  const version = state.current.version
  // A confirmed version advance retires requests whose expectedVersion is now stale.
  // An unchanged version retains the same client and idempotency key for retries.
  const mutations = useMemo(() => ({
    version,
    client: new Client(props.csrfToken),
  }), [props.csrfToken, version])
  const execute = useHistoryFlight(state)
  const path = `/api/admin/documents/${state.current.documentId}`
  const refresh = async (): Promise<void> => await refreshHistory(path, state)
  const more = async (): Promise<void> => {
    if (state.history.nextBefore === null) {
      return
    }
    const older = await get(`${path}/revisions?before=${state.history.nextBefore}`, historySchema)
    state.setHistory(old => ({ ...older, items: [
      ...old.items,
      ...older.items,
    ] }))
  }
  return {
    ...state,
    choose: async (id, side) => await chooseRevision(path, state, id, side),
    more: async () => {
      await execute(more)
    },
    refresh: async () => {
      await execute(refresh)
    },
    perform: async (action) => {
      if (state.refreshRequired || state.loading) {
        return false
      }
      const confirmed = await execute(async () => await performHistoryAction(path, state, mutations.client, action))
      return confirmed === true
    },
  }
}
function useHistoryState(props: HistoryPageProps): {
  current: OpenDocument
  history: History
  baseline: SavedRevision
  selected: SavedRevision
  busy: boolean
  loading: boolean
  notice: HistoryModel['notice']
  error: string
  errorIssues: PublicationIssue[]
  refreshRequired: boolean
  generationRef: React.RefObject<number>
  setCurrent: React.Dispatch<React.SetStateAction<OpenDocument>>
  setHistory: React.Dispatch<React.SetStateAction<History>>
  setBaseline: React.Dispatch<React.SetStateAction<SavedRevision>>
  setSelected: React.Dispatch<React.SetStateAction<SavedRevision>>
  setBusy: React.Dispatch<React.SetStateAction<boolean>>
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  setNotice: React.Dispatch<React.SetStateAction<HistoryModel['notice']>>
  setError: React.Dispatch<React.SetStateAction<string>>
  setErrorIssues: React.Dispatch<React.SetStateAction<PublicationIssue[]>>
  setRefreshRequired: React.Dispatch<React.SetStateAction<boolean>>
} {
  const [current, setCurrent] = useState(props.initial)
  const [history, setHistory] = useState(props.history)
  const head = { revisionId: props.initial.headRevisionId, document: props.initial.document }
  const [baseline, setBaseline] = useState<SavedRevision>(head)
  const [selected, setSelected] = useState<SavedRevision>(head)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<HistoryModel['notice']>(null)
  const [error, setError] = useState('')
  const [errorIssues, setErrorIssues] = useState<PublicationIssue[]>([])
  const [refreshRequired, setRefreshRequired] = useState(false)
  const generationRef = useRef(0)
  return {
    current,
    history,
    baseline,
    selected,
    busy,
    loading,
    notice,
    error,
    errorIssues,
    refreshRequired,
    generationRef,
    setCurrent,
    setHistory,
    setBaseline,
    setSelected,
    setBusy,
    setLoading,
    setNotice,
    setError,
    setErrorIssues,
    setRefreshRequired,
  }
}
type HistoryState = ReturnType<typeof useHistoryState>
function useHistoryFlight(state: HistoryState): <R>(task: () => Promise<R>) => Promise<R | null> {
  const flightRef = useRef(false)
  return async <R>(task: () => Promise<R>): Promise<R | null> => {
    if (flightRef.current) {
      return null
    }
    flightRef.current = true
    state.setBusy(true)
    state.setError('')
    state.setErrorIssues([])
    try {
      return await task()
    }
    catch (failure) {
      const code = failure instanceof APIError ? failure.code : 'CONNECTION_FAILED'
      state.setError(state.refreshRequired ? 'HISTORY_REFRESH_REQUIRED' : code)
      state.setErrorIssues(failure instanceof APIError ? failure.issues : [])
      return null
    }
    finally {
      flightRef.current = false
      state.setBusy(false)
    }
  }
}
async function refreshHistory(path: string, state: HistoryState): Promise<void> {
  const [latest, revisions] = await Promise.all([
    get(path, openDocumentSchema),
    get(`${path}/revisions`, historySchema),
  ])
  state.generationRef.current++
  state.setLoading(false)
  state.setRefreshRequired(false)
  state.setCurrent(latest)
  state.setHistory(revisions)
  state.setBaseline({ revisionId: latest.headRevisionId, document: latest.document })
}
async function chooseRevision(
  path: string,
  state: HistoryState,
  id: string,
  side: 'baseline' | 'selected',
): Promise<void> {
  if (state.busy || state.refreshRequired) {
    return
  }
  const request = ++state.generationRef.current
  state.setLoading(true)
  state.setError('')
  state.setErrorIssues([])
  state.setNotice(null)
  try {
    const revision = id === state.current.headRevisionId
      ? { revisionId: id, document: state.current.document }
      : await get(`${path}/revisions/${id}`, revisionSchema)
    if (request === state.generationRef.current) {
      if (side === 'baseline') {
        state.setBaseline(revision)
      }
      else {
        state.setSelected(revision)
      }
    }
  }
  catch (failure) {
    if (request === state.generationRef.current) {
      state.setError(failure instanceof APIError ? failure.code : 'CONNECTION_FAILED')
    }
  }
  finally {
    if (request === state.generationRef.current) {
      state.setLoading(false)
    }
  }
}
async function performHistoryAction(
  path: string,
  state: HistoryState,
  client: Client,
  action: HistoryAction,
): Promise<boolean> {
  state.setNotice(null)
  let ack: Acknowledgement
  try {
    ack = await client.write(`${path}/${action}`, 'POST', {
      expectedVersion: state.current.version,
      revisionId: state.selected.revisionId,
      ...(action === 'publish' ? { expectedLiveGeneration: state.current.liveGeneration } : {}),
    })
  }
  catch (failure) {
    if (failure instanceof APIError && failure.status === 409 && failure.code === 'EDIT_CONFLICT') {
      state.setRefreshRequired(true)
      state.setNotice('conflict')
      await refreshAfterAction(path, state)
      return false
    }
    if (failure instanceof APIError && failure.code === 'MAINTENANCE') {
      throw failure
    }
    if (outcomeUnknown(failure)) {
      state.setRefreshRequired(true)
      state.setError('HISTORY_OUTCOME_UNKNOWN')
      return false
    }
    throw failure
  }
  acceptHistoryAction(state, ack, action)
  await refreshAfterAction(path, state)
  return true
}

function outcomeUnknown(failure: unknown): boolean {
  return !(failure instanceof APIError) || failure.status === 0 || failure.status >= 500
}

function acceptHistoryAction(state: HistoryState, ack: Acknowledgement, action: HistoryAction): void {
  const document = action === 'restore' ? state.selected.document : state.current.document
  state.setCurrent({
    ...state.current,
    ...ack,
    document,
    livePath: action === 'publish'
      ? publicationPath(state.current.kind, state.selected.document.meta.slug)
      : state.current.livePath,
  })
  if (action === 'restore') {
    state.setBaseline({ revisionId: ack.headRevisionId, document })
  }
  state.setRefreshRequired(true)
}

async function refreshAfterAction(path: string, state: HistoryState): Promise<void> {
  try {
    await refreshHistory(path, state)
  }
  catch {
    state.setError('HISTORY_REFRESH_REQUIRED')
  }
}
