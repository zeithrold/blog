import type { Workspace } from '@/features/editor/workspace/editor-types'
import { SuggestionMenu } from '@blocknote/core/extensions'
import { useRef } from 'react'
import { selectBeforeBlockDeletion } from '@/features/editor/engine/block-deletion'

export function useInputGuards(workspace: Workspace): {
  onCompositionStartCapture: () => void
  onCompositionEndCapture: () => void
  onDropCapture: (event: React.DragEvent) => void
  onPasteCapture: (event: React.ClipboardEvent) => void
  onKeyDownCapture: (event: React.KeyboardEvent) => void
} {
  const pendingDeletionRef = useRef<string | null>(null)
  const { model, draft } = workspace
  const { editor, composingRef } = model
  return {
    onKeyDownCapture: (event) => {
      if ((event.key === 'Backspace' || event.key === 'Delete')
        && event.target instanceof HTMLElement && event.target.closest('button') !== null) {
        // A control's deletion key must never reach ProseMirror's document commands.
        event.preventDefault()
        event.stopPropagation()
        return
      }
      selectBeforeBlockDeletion(event, workspace, pendingDeletionRef)
    },
    onCompositionStartCapture: () => {
      composingRef.current = true
      draft.coordinator.setComposing(true)
      editor.getExtension(SuggestionMenu)?.closeMenu()
    },
    onCompositionEndCapture: () => {
      composingRef.current = false
      draft.coordinator.setComposing(false)
      draft.changed()
    },
    onPasteCapture: (event: React.ClipboardEvent) => {
      receiveFiles(event, event.clipboardData.files, workspace)
    },
    onDropCapture: (event: React.DragEvent) => {
      receiveFiles(event, event.dataTransfer.files, workspace)
    },
  }
}

function receiveFiles(event: React.SyntheticEvent, files: FileList, workspace: Workspace): void {
  if (files.length === 0) {
    return
  }
  // File insertion already waits for composition to finish. Keep all native
  // file events in that tracked pipeline instead of falling through to BlockNote.
  event.preventDefault()
  event.stopPropagation()
  if (workspace.busy) {
    workspace.draft.setError('Wait for the draft to finish saving, then retry.')
    return
  }
  workspace.run(workspace.model.uploadFiles(Array.from(files)))
}
