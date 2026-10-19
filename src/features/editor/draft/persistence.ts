import type { PublicationIssue } from '@/content/publication-issues'
import type { OpenDocument } from '@/contracts/documents'
import type { DraftStatus } from '@/features/editor/draft/draft'
import type { PublicationRejection } from '@/features/editor/draft/draft-errors'
import type { DocumentModel } from '@/features/editor/workspace/document-model'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { acknowledgementSchema } from '@/contracts/documents'
import { DraftCoordinator } from '@/features/editor/draft/draft'
import { useDraftErrors } from '@/features/editor/draft/draft-errors'
import { recovery } from '@/features/editor/draft/recovery'
import { Client } from '@/shared/admin/api-client'

type DraftInput = {
  initial: OpenDocument
  owner: string
  csrfToken: string
  model: DocumentModel
  recovered: boolean
}

export type Draft = {
  client: Client
  coordinator: DraftCoordinator
  status: DraftStatus
  ack: DraftCoordinator['acknowledgement']
  error: string
  rejection: PublicationRejection | null
  setError: (message: string, issues?: PublicationIssue[]) => void
  localNotice: string
  changed: () => void
  persistLocal: () => Promise<boolean>
}

export function useDraft(input: DraftInput): Draft {
  const { initial, model } = input
  const [status, setStatus] = useState<DraftStatus>('saved')
  const [ack, setAck] = useState<DraftCoordinator['acknowledgement']>(initial)
  const errors = useDraftErrors(model)
  const [localNotice, setLocalNotice] = useState('')
  const client = useMemo(() => new Client(input.csrfToken, input.owner), [input.csrfToken, input.owner])
  const coordinator = useCoordinator({
    initial,
    client,
    snapshot: model.snapshot,
    status: (next, acknowledgement, code) => {
      setStatus(next)
      setAck(acknowledgement)
      errors.statusError(code)
    },
  })
  const persistLocal = useLocalRecovery({
    owner: input.owner,
    initial,
    model,
    coordinator,
    setLocalNotice,
  })
  const changed = useLocalTimer(coordinator, persistLocal)
  useDraftLifecycle({
    coordinator,
    model,
    persistLocal,
    changed,
  })
  useEffect(() => {
    if (input.recovered) {
      changed()
    }
  }, [input.recovered, changed])
  return {
    client,
    coordinator,
    status,
    ack,
    ...errors,
    localNotice,
    changed,
    persistLocal,
  }
}
type LocalRecoveryInput = {
  owner: string
  initial: OpenDocument
  model: DocumentModel
  coordinator: DraftCoordinator
  setLocalNotice: (value: string) => void
}

function useLocalRecovery(input: LocalRecoveryInput): () => Promise<boolean> {
  const { owner, coordinator, setLocalNotice } = input
  const { documentId } = input.initial
  const { composingRef, snapshot } = input.model
  const flightRef = useRef<Promise<boolean> | null>(null)
  return useCallback(
    async function persist(): Promise<boolean> {
      if (composingRef.current) {
        return false
      }
      if (flightRef.current !== null) {
        await flightRef.current
        return await persist()
      }
      flightRef.current = (async () => {
        try {
          const editSeq = coordinator.editSeq
          const baseRevisionId = coordinator.acknowledgement.headRevisionId
          const document = await snapshot()
          const savedAt = Date.now()
          await recovery(owner, documentId, {
            owner,
            documentId,
            baseRevisionId,
            editSeq,
            savedAt,
            document,
          })
          setLocalNotice(localTime(savedAt))
          return true
        }
        catch {
          setLocalNotice(
            'Local recovery unavailable. Keep this tab open until a server save succeeds.',
          )
          return false
        }
      })()
      try {
        return await flightRef.current
      }
      finally {
        flightRef.current = null
      }
    },
    [
      owner,
      documentId,
      snapshot,
      composingRef,
      coordinator,
      setLocalNotice,
    ],
  )
}
function useLocalTimer(
  coordinator: DraftCoordinator,
  persist: () => Promise<boolean>,
): () => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const deadlineRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timerRef.current)
      clearTimeout(deadlineRef.current)
    },
    [],
  )
  return useCallback(() => {
    coordinator.change()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      persist().catch(() => false)
    }, 1000)
    deadlineRef.current ??= setTimeout(() => {
      deadlineRef.current = undefined
      persist().catch(() => false)
    }, 10000)
  }, [coordinator, persist])
}
function useDraftLifecycle(input: {
  coordinator: DraftCoordinator
  model: DocumentModel
  persistLocal: () => Promise<boolean>
  changed: () => void
}): void {
  const { coordinator, model, persistLocal, changed } = input
  useEffect(() => {
    const stop = model.editor.onChange((_editor, transaction) => {
      if (transaction.getChanges().length > 0) {
        changed()
      }
    })
    const unload = (event: BeforeUnloadEvent): void => {
      if (coordinator.dirty) {
        event.preventDefault()
      }
    }
    const hidden = (): void => {
      if (document.visibilityState === 'hidden' && coordinator.editSeq > 0) {
        persistLocal().catch(() => false)
      }
    }
    const pagehide = (): void => {
      // An untouched session may still have an earlier recovery copy awaiting
      // the author's decision. Keep it until this session starts editing. Use
      // editSeq rather than dirty so a completed server save can update the
      // recovery copy's base revision on the next lifecycle checkpoint.
      if (coordinator.editSeq > 0) {
        persistLocal().catch(() => false)
      }
    }
    const online = (): void => {
      coordinator.flush().catch(() => false)
    }
    window.addEventListener('beforeunload', unload)
    window.addEventListener('pagehide', pagehide)
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      stop()
      coordinator.dispose()
      window.removeEventListener('beforeunload', unload)
      window.removeEventListener('pagehide', pagehide)
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [
    coordinator,
    model.editor,
    persistLocal,
    changed,
  ])
}

function useCoordinator(input: {
  initial: OpenDocument
  client: Client
  snapshot: DocumentModel['snapshot']
  status: ConstructorParameters<typeof DraftCoordinator>[3]
}): DraftCoordinator {
  const { initial, client, snapshot } = input
  const signals = useMemo(() => new DraftSignals(), [])
  useEffect(() => {
    signals.listen(input.status)
  }, [input.status, signals])
  return useMemo(
    () =>
      new DraftCoordinator(
        initial,
        snapshot,
        async packet =>
          await client.mutate({
            path: `/api/admin/documents/${initial.documentId}/revisions`,
            method: 'PUT',
            body: packet.body,
            key: packet.key,
            schema: acknowledgementSchema,
          }),
        (next, ack, code) => signals.notify(next, ack, code),
      ),
    [
      initial,
      client,
      snapshot,
      signals,
    ],
  )
}

class DraftSignals {
  private status: ConstructorParameters<typeof DraftCoordinator>[3] = () => {}
  listen(status: DraftSignals['status']): void {
    this.status = status
  }

  notify(...args: Parameters<DraftSignals['status']>): void {
    this.status(...args)
  }
}

function localTime(savedAt: number): string {
  return `Local copy saved ${new Date(savedAt).toLocaleTimeString()}`
}
