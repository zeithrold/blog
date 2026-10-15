'use client'
import type { ReactNode } from 'react'
import type { MediaUploadModel } from '@/features/media/upload-queue'
import { Upload } from 'lucide-react'
import { useState } from 'react'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerNested,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/ztd-me/client'
import { MediaUploadForm } from '@/features/media/media-upload-form'
import { useCompactLayout } from '@/hooks/use-compact-layout'
import { EditorText } from '@/i18n/labels'

const utility1Class = [
  'media-upload-dialog w-[min(640px,_calc(100vw_-_32px))] max-w-160 max-h-[calc(100dvh_-_48px)]',
].join(' ')

const utility2Class = [
  '[&_>_:is(.app-drawer-header,_.app-drawer-footer)]:shrink-0 [&_.media-upload-form]:px-5',
].join(' ')

const layout1Class = [utility1Class, 'overflow-y-auto'].join(' ')

const layout2Class = ['media-upload-drawer max-h-[calc(100dvh_-_24px)] overflow-hidden', utility2Class].join(' ')

type Model = MediaUploadModel & { loading?: boolean }
type Props = { model: Model, open: boolean, setOpen: (open: boolean) => void, children?: ReactNode }
type OverlayProps = {
  model: Model
  open?: boolean
  onOpenChange?: (open: boolean) => void
  nested?: boolean
  children?: ReactNode
}
const DESCRIPTION = 'Choose files or drag them here. Uploads stay private until published in a document.'

export function MediaUploadOverlay({
  model,
  open: controlledOpen,
  onOpenChange,
  nested = false,
  children,
}: OverlayProps): ReactNode {
  const [localOpen, setLocalOpen] = useState(false)
  const open = controlledOpen ?? localOpen
  const compact = useCompactLayout()
  const change = (value: boolean): void => {
    if (!model.queue.snapshot().running) {
      (onOpenChange ?? setLocalOpen)(value)
    }
  }
  return compact
    ? <MobileUpload {...{ model, open, setOpen: change, nested }}>{children}</MobileUpload>
    : <DesktopUpload {...{ model, open, setOpen: change }}>{children}</DesktopUpload>
}

function uploadTrigger(model: Model): ReactNode {
  return (
    <Button type="button" variant="default" disabled={model.loading === true && model.uploads.items.length === 0}>
      <Upload size={17} aria-hidden="true" />
      <EditorText value="Upload media" />
    </Button>
  )
}

function DesktopUpload({ model, open, setOpen, children }: Props): ReactNode {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{uploadTrigger(model)}</DialogTrigger>
      <DialogContent
        className={layout1Class}
        onEscapeKeyDown={(event) => {
          if (model.queue.snapshot().running) {
            event.preventDefault()
          }
        }}
        onInteractOutside={(event) => {
          if (model.queue.snapshot().running) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle><EditorText value="Upload media" /></DialogTitle>
          <DialogDescription><EditorText value={DESCRIPTION} /></DialogDescription>
        </DialogHeader>
        <MediaUploadForm model={model} />
        {children}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={model.uploading}>
              <EditorText value="Close" />
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MobileUpload({ model, open, setOpen, nested, children }: Props & { nested: boolean }): ReactNode {
  const Root = nested ? DrawerNested : Drawer
  return (
    <Root open={open} onOpenChange={setOpen} dismissible={!model.uploading}>
      <DrawerTrigger asChild>{uploadTrigger(model)}</DrawerTrigger>
      <DrawerContent
        className={layout2Class}
        onEscapeKeyDown={(event) => {
          if (model.queue.snapshot().running) {
            event.preventDefault()
          }
        }}
        onInteractOutside={(event) => {
          if (model.queue.snapshot().running) {
            event.preventDefault()
          }
        }}
      >
        <DrawerHeader>
          <DrawerTitle><EditorText value="Upload media" /></DrawerTitle>
          <DrawerDescription><EditorText value={DESCRIPTION} /></DrawerDescription>
        </DrawerHeader>
        <div
          className={[
            'media-upload-drawer-body flex-[1_1_auto] min-h-0 overflow-y-auto',
            '[overscroll-behavior:contain]',
          ].join(' ')}
          data-vaul-no-drag
        >
          <MediaUploadForm model={model} />
          {children}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button type="button" variant="outline" disabled={model.uploading}>
              <EditorText value="Close" />
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Root>
  )
}
