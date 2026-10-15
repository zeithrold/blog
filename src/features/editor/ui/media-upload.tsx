import type { ReactNode } from 'react'
import type { Workspace } from '@/features/editor/core/editor-types'
import type { EditorUploadModel } from '@/features/editor/services/editor-upload-model'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ztd-me/client'
import { MediaSources } from '@/features/editor/ui/media-sources'
import { useCompactLayout } from '@/hooks/use-compact-layout'
import { EditorText } from '@/i18n/labels'
import { useEditorLabels } from '@/i18n/use-labels'

export type EditorMediaProps = { workspace: Workspace, model: EditorUploadModel }
const DESCRIPTION = 'Upload a file or choose existing media. Descriptions belong to this media block.'

export function EditorMediaOverlay(props: EditorMediaProps): ReactNode {
  const compact = useCompactLayout()
  return compact ? <MobileMedia {...props} /> : <DesktopMedia {...props} />
}

function useMediaOverlay({ workspace, model }: EditorMediaProps) {
  const text = useEditorLabels()
  return {
    title: text(model.editing ? 'Edit media' : 'Add media'),
    description: text(DESCRIPTION),
    guard: (event: { preventDefault: () => void }): void => {
      if (model.queue.snapshot().running) {
        event.preventDefault()
      }
    },
    focusEditor: (event: { preventDefault: () => void }): void => {
      event.preventDefault()
      // A closing drawer can finish after another contextual dialog has opened.
      if (document.querySelector('[role="dialog"][data-state="open"]') === null) {
        workspace.model.editor.focus()
      }
    },
    footer: (
      <Button type="button" variant="outline" disabled={model.uploading} onClick={() => model.setOpen(false)}>
        <EditorText value="Close" />
      </Button>
    ),
  }
}

function MobileMedia(props: EditorMediaProps): ReactNode {
  const { model } = props
  const { title, description, guard, focusEditor, footer } = useMediaOverlay(props)
  return (
    <Drawer open={model.open} onOpenChange={model.setOpen} dismissible={!model.uploading}>
      <DrawerContent
        className="editor-media-drawer max-h-[90dvh] overflow-hidden"
        onEscapeKeyDown={guard}
        onInteractOutside={guard}
        onCloseAutoFocus={focusEditor}
      >
        <DrawerHeader className="shrink-0">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-vaul-no-drag>
          {model.open && <MediaSources {...props} />}
        </div>
        <DrawerFooter className="shrink-0">{footer}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function DesktopMedia(props: EditorMediaProps): ReactNode {
  const { model } = props
  const { title, description, guard, focusEditor, footer } = useMediaOverlay(props)
  return (
    <Dialog open={model.open} onOpenChange={model.setOpen}>
      <DialogContent
        className="editor-media-dialog w-[min(720px,calc(100vw-32px))] max-h-[calc(100dvh-48px)]"
        onEscapeKeyDown={guard}
        onInteractOutside={guard}
        onCloseAutoFocus={focusEditor}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {model.open && <MediaSources {...props} />}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
