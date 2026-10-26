import type { ReactNode } from 'react'
import type { ScheduleModel } from '@/features/editor/publication/schedule-controller'
import type { useActions } from '@/features/editor/workspace/actions'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { DraftPreviewProvider } from '@/features/editor/preview/live-preview'
import { EditorHeader } from '@/features/editor/workspace/header'

/*
 * The production header module. Its navigation-guard import requires the host
 * aliases for `next/link` and `next/navigation`, so every module importing this
 * file needs the official Vitest aliases. The host anchor proves link presence
 * and href, not Next routing.
 */

export function PublicationHeader({
  workspace,
  actions,
  schedule,
  livePath,
}: {
  workspace: Workspace
  actions: ReturnType<typeof useActions>
  schedule: ScheduleModel
  livePath: () => string | null
}): ReactNode {
  return (
    <DraftPreviewProvider workspace={workspace}>
      <EditorHeader
        workspace={workspace}
        publish={actions.publish}
        remove={actions.remove}
        livePath={livePath()}
        schedules={schedule.items}
      />
    </DraftPreviewProvider>
  )
}
