import type { z } from 'zod'
import type { assetDescriptorSchema } from '@/contracts/media'
import type { MediaDestination } from '@/features/editor/media/media-insertion'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { insertReadyMedia } from '@/features/editor/media/media-insertion'

export function attachMedia(
  workspace: Workspace,
  asset: z.infer<typeof assetDescriptorSchema>,
  destination?: MediaDestination,
): void {
  if (workspace.busy || workspace.model.composingRef.current || asset.state !== 'ready') {
    return
  }
  if (asset.role === 'caption' || asset.role === 'poster') {
    return
  }
  insertReadyMedia({
    editor: workspace.model.editor,
    fields: workspace.model.envelope,
    update: workspace.model.updateFields,
  }, asset, destination ?? { anchor: workspace.model.editor.getTextCursorPosition().block.id })
  workspace.draft.changed()
}
