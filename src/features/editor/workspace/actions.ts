import type { Draft } from '@/features/editor/draft/persistence'
import type { DocumentModel } from '@/features/editor/workspace/document-model'
import type { SessionProps, Workspace } from '@/features/editor/workspace/editor-types'
import { useRef, useState } from 'react'
import { openDocumentSchema } from '@/contracts/documents'
import { APIError, get } from '@/shared/admin/api-client'
import { announceConfirmed } from '@/shared/admin/toast-feedback'

/**
 * Exactly the workspace fields these actions read. A full `Workspace`
 * satisfies it; a test can supply the same fields without a BlockNote host.
 */
export type ActionWorkspace = {
  readonly props: Pick<SessionProps, 'initial' | 'reopen'>
  readonly model: Pick<DocumentModel, 'composingRef' | 'waitUploads'>
  readonly draft: Pick<Draft, 'client' | 'coordinator' | 'setError'>
}

type Actions = {
  busy: boolean
  run: Workspace['run']
  perform: Workspace['perform']
  publish: (unpublish?: boolean) => Promise<boolean>
  restore: (revisionId: string) => Promise<boolean>
  remove: () => Promise<boolean>
}

export function useActions(input: ActionWorkspace): Actions {
  const flightRef = useRef(false)
  const reloadRequiredRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [reloadRequired, setReloadRequired] = useState(false)
  const { props, model, draft } = input
  const basePath = `/api/admin/documents/${props.initial.documentId}`
  const run = actionRunner(draft)
  const perform: Workspace['perform'] = async (task, options) => {
    if (model.composingRef.current || flightRef.current || reloadRequiredRef.current) {
      return false
    }
    flightRef.current = true
    setBusy(true)
    try {
      if (options?.saveDraft !== false) {
        await model.waitUploads()
        if (!(await draft.coordinator.settle())) {
          return false
        }
      }
      await task()
      return true
    }
    finally {
      flightRef.current = false
      setBusy(false)
    }
  }
  const publish = async (unpublish = false): Promise<boolean> => {
    return await perform(async () => await publishDocument(draft, basePath, unpublish))
  }
  return {
    busy: busy || reloadRequired,
    run,
    perform,
    publish,
    restore: async (revision) => {
      return await perform(async () => await restoreDocument({
        draft,
        props,
        basePath,
        accepted: () => {
          // The old body must never save against the restored revision.
          reloadRequiredRef.current = true
          setReloadRequired(true)
          draft.coordinator.dispose()
        },
      }, revision))
    },
    remove: async () => {
      return await perform(async () => await removeDocument(draft, basePath))
    },
  }
}

async function publishDocument(draft: ActionWorkspace['draft'], basePath: string, unpublish: boolean): Promise<void> {
  const base = draft.coordinator.acknowledgement
  const result = await draft.client.write(
    `${basePath}/${unpublish ? 'unpublish' : 'publish'}`,
    'POST',
    {
      expectedVersion: base.version,
      expectedLiveGeneration: base.liveGeneration,
      ...(unpublish ? {} : { revisionId: base.headRevisionId }),
    },
  )
  acceptPublication(draft, result, unpublish)
}

function acceptPublication(draft: ActionWorkspace['draft'], result: Draft['ack'], unpublish: boolean): void {
  draft.coordinator.accept(result)
  if (!unpublish) {
    draft.setError('')
  }
}

/**
 * The caller passes a success message only for an explicit action it started;
 * the toast waits for the accepted response and never fires for a skipped task.
 */
function actionRunner(draft: ActionWorkspace['draft']): Workspace['run'] {
  return (task, success) => {
    reportFailure(draft, task)
    if (success !== undefined) {
      announceConfirmed(task, success)
    }
  }
}

function reportFailure(draft: ActionWorkspace['draft'], task: Promise<unknown>): void {
  task.catch((failure: unknown) => {
    if (failure instanceof APIError && failure.message === 'EDIT_CONFLICT') {
      draft.coordinator.conflict()
    }
    draft.setError(
      failure instanceof Error ? failure.message : 'Operation failed.',
      failure instanceof APIError ? failure.issues : [],
    )
  })
}

async function restoreDocument(
  input: {
    draft: ActionWorkspace['draft']
    props: ActionWorkspace['props']
    basePath: string
    accepted: () => void
  },
  revisionId: string,
): Promise<void> {
  const { draft, props, basePath } = input
  const ack = await draft.client.write(`${basePath}/restore`, 'POST', {
    expectedVersion: draft.coordinator.acknowledgement.version,
    revisionId,
  })
  draft.coordinator.accept(ack)
  input.accepted()
  try {
    props.reopen(await get(basePath, openDocumentSchema))
  }
  catch {
    // The write succeeded. Preserve that result and retry only the read via a
    // page reload, rather than offering to repeat a committed restore.
    draft.setError('RESTORE_RELOAD_REQUIRED')
  }
}
async function removeDocument(draft: ActionWorkspace['draft'], basePath: string): Promise<void> {
  const base = draft.coordinator.acknowledgement
  await draft.client.write(basePath, 'DELETE', {
    expectedVersion: base.version,
    expectedLiveGeneration: base.liveGeneration,
  })
  window.location.assign('/admin')
}
