import type { ReactNode } from 'react'
import type { Envelope } from '@/features/editor/workspace/document-model'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { DraftPreviewProvider } from '@/features/editor/preview/live-preview'
import { useScheduleList } from '@/features/editor/publication/schedule-controller'
import { EditorSettings } from '@/features/editor/workspace/settings'

export function ReferenceSettingsLayout({
  workspace,
  restore,
  update,
}: {
  workspace: Workspace
  restore: (revision: string) => Promise<void>
  update: (patch: Partial<Envelope>) => void
}): ReactNode {
  const schedules = useScheduleList(workspace)
  return (
    <DraftPreviewProvider workspace={workspace}>
      <EditorSettings
        workspace={workspace}
        update={update}
        restore={restore}
        livePath={null}
        schedules={schedules}
      />
    </DraftPreviewProvider>
  )
}
