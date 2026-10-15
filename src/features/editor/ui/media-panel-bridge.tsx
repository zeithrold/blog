import type { ReactNode } from 'react'
import { FilePanelExtension } from '@blocknote/core/extensions'
import { useExtension, useExtensionState } from '@blocknote/react'
import { use, useEffect } from 'react'
import { EditorMediaContext } from '@/features/editor/ui/media-context'

export function MediaPanelBridge(): ReactNode {
  const panel = useExtension(FilePanelExtension)
  const id = useExtensionState(FilePanelExtension)
  const media = use(EditorMediaContext)
  useEffect(() => {
    if (id !== undefined && media !== null) {
      media.request(id)
      panel.closeMenu()
    }
  }, [
    id,
    panel,
    media,
  ])
  return null
}
