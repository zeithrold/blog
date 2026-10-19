import type { Workspace } from '@/features/editor/workspace/editor-types'
import { useRef, useState } from 'react'
import { openDocumentSchema } from '@/contracts/documents'
import { APIError, get } from '@/shared/admin/api-client'

type Actions = {
  busy: boolean
  run: (task: Promise<unknown>) => void
  perform: Workspace['perform']
  publish: (unpublish?: boolean) => Promise<void>
  restore: (revisionId: string) => Promise<void>
  remove: () => Promise<void>
}

export function useActions(input: Pick<Workspace, 'props' | 'model' | 'draft'>): Actions {
  const flightRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const { props, model, draft } = input
  const basePath = `/api/admin/documents/${props.initial.documentId}`
  const run = errorRunner(draft)
  const perform: Workspace['perform'] = async (task, options) => {
    if (model.composingRef.current || flightRef.current) {
      return
    }
    flightRef.current = true
    setBusy(true)
    try {
      if (options?.saveDraft !== false) {
        await model.waitUploads()
        if (!(await draft.coordinator.settle())) {
          return
        }
      }
      await task()
    }
    finally {
      flightRef.current = false
      setBusy(false)
    }
  }
  const publish = async (unpublish = false): Promise<void> => {
    await perform(async () => {
      const base = draft.coordinator.acknowledgement
      const result = await draft.client.write(
        `${basePath}/${unpublish ? 'unpublish' : 'publish'}`,
        'POST',
        {
          expectedVersion: base.version,
          expectedLiveGeneration: base.liveGeneration,
          ...(unpublish
            ? {}
            : {
                revisionId: base.headRevisionId,
              }),
        },
      )
      acceptPublication(draft, result, unpublish)
    })
  }
  return {
    busy,
    run,
    perform,
    publish,
    restore: async (revision) => {
      await perform(async () => await restoreDocument({ draft, props, basePath }, revision))
    },
    remove: async () => {
      await perform(async () => await removeDocument(draft, basePath))
    },
  }
}

function acceptPublication(draft: Workspace['draft'], result: Workspace['draft']['ack'], unpublish: boolean): void {
  draft.coordinator.accept(result)
  if (!unpublish) {
    draft.setError('')
  }
}

function errorRunner(draft: Workspace['draft']): Actions['run'] {
  return (task) => {
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
}

async function restoreDocument(
  input: { draft: Workspace['draft'], props: Workspace['props'], basePath: string },
  revisionId: string,
): Promise<void> {
  const { draft, props, basePath } = input
  await draft.client.write(`${basePath}/restore`, 'POST', {
    expectedVersion: draft.coordinator.acknowledgement.version,
    revisionId,
  })
  props.reopen(await get(basePath, openDocumentSchema))
}
async function removeDocument(draft: Workspace['draft'], basePath: string): Promise<void> {
  const base = draft.coordinator.acknowledgement
  await draft.client.write(basePath, 'DELETE', {
    expectedVersion: base.version,
    expectedLiveGeneration: base.liveGeneration,
  })
  window.location.assign('/admin')
}
