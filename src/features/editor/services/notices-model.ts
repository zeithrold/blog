import type { Workspace } from '@/features/editor/core/editor-types'
import type { Recovery } from '@/features/editor/core/recovery'
import type { OpenDocument } from '@/features/editor/services/api-client'
import { useEffect, useRef, useState } from 'react'
import { stableJSON } from '@/content/canonical'
import { openDocumentSchema } from '@/content/contracts'
import { recovery } from '@/features/editor/core/recovery'
import { get } from '@/features/editor/services/api-client'

type Notices = {
  local: Recovery | null
  remote: OpenDocument | null
  confirm: boolean
  setLocal: (value: Recovery | null) => void
  setConfirm: (value: boolean) => void
  refreshRemote: () => Promise<void>
}

export function useConflictResolution(
  workspace: Workspace,
  setResolving: (busy: boolean) => void,
  refreshRemote: () => Promise<void>,
): (task: () => Promise<void>) => void {
  const flightRef = useRef(false)
  return (task) => {
    if (workspace.busy || workspace.model.composingRef.current || flightRef.current) {
      return
    }
    flightRef.current = true
    setResolving(true)
    workspace.run((async () => {
      try {
        await workspace.model.waitUploads()
        await task()
      }
      catch (error) {
        await refreshRemote().catch(() => undefined)
        throw error
      }
      finally {
        flightRef.current = false
        setResolving(false)
      }
    })())
  }
}
export function useNotices(workspace: Workspace): Notices {
  const { props } = workspace
  const { status, setError } = workspace.draft
  const [local, setLocal] = useState<Recovery | null>(null)
  const [remote, setRemote] = useState<OpenDocument | null>(null)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    let active = true
    void recovery(props.owner, props.initial.documentId)
      .then((value) => {
        if (
          active
          && value !== null
          && stableJSON(value.document) !== stableJSON(props.initial.document)
        ) {
          setLocal(value)
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [props.owner, props.initial])
  useEffect(() => {
    if (status !== 'conflict') {
      return
    }
    let active = true
    void get(`/api/admin/documents/${props.initial.documentId}`, openDocumentSchema)
      .then((value) => {
        if (active) {
          setRemote(value)
        }
      })
      .catch(() => setError('Could not load the server revision.'))
    return () => {
      active = false
    }
  }, [
    status,
    props.initial.documentId,
    setError,
  ])
  return {
    local,
    setLocal,
    remote,
    confirm,
    setConfirm,
    refreshRemote: async () => {
      setRemote(await get(`/api/admin/documents/${props.initial.documentId}`, openDocumentSchema))
    },
  }
}
