import type { ReactNode } from 'react'
import type { PreviewModel } from '@/features/editor/preview/preview-model'
import { Eye, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { DraftPreviewContext, useDraftPreview } from '@/features/editor/preview/draft-preview-context'
import { usePreview } from '@/features/editor/preview/preview-model'
import { useEditorLabels } from '@/i18n/use-labels'

const utility1Class = [
  'draft-preview-header flex shrink-0 items-start justify-between gap-4 py-5 px-6 border-b',
].join(' ')

const utility2Class = [
  'border-border [&_>_div]:min-w-0 [&_.ztd-dialog-title]:text-[length:17px]',
  '[&_.ztd-help]:mt-[6px]',
].join(' ')

const utility3Class = [
  '[&_.ztd-help]:mx-0 [&_.ztd-help]:mb-0 [&_.ztd-help]:text-[length:13px]',
  '[&_.ztd-help]:leading-[1.6]',
].join(' ')

const utility4Class = [
  '[&_button]:shrink-0 [&_button]:w-11 [&_button]:h-11 [&_button]:mt-[-8px] [&_button]:mr-[-8px]',
].join(' ')

const utility5Class = [
  '[&_button]:mb-0 [&_button]:ml-0 max-[701px]:pt-[max(20px,_env(safe-area-inset-top))]',
  'max-[701px]:pb-5 max-[701px]:px-4',
].join(' ')

const utility6Class = [
  'draft-preview-reader flex-1 min-h-0 overflow-y-auto [overscroll-behavior:contain] py-9',
].join(' ')

const utility7Class = [
  'px-[clamp(24px,_6vw,_64px)] [&_.reader]:w-full [&_.reader]:max-w-180 [&_.reader]:min-w-0',
].join(' ')

const utility8Class = [
  '[&_.reader]:my-0 [&_.reader]:mx-auto [&_.reader]:p-0 max-[701px]:pt-7 max-[701px]:px-5',
].join(' ')

const layout1Class = [
  utility1Class,
  utility2Class,
  utility3Class,
  utility4Class,
  utility5Class,
].join(' ')

const layout2Class = [
  utility6Class,
  utility7Class,
  utility8Class,
  'max-[701px]:pb-[max(28px,_env(safe-area-inset-bottom))]',
].join(' ')

const previewDialogClass = [
  'draft-preview-dialog flex flex-col gap-0 w-[min(960px,calc(100vw-48px))]',
  'h-[min(840px,calc(100dvh-48px))] max-h-[calc(100dvh-48px)] overflow-hidden p-0 bg-background',
  'max-[701px]:inset-0 max-[701px]:w-full max-[701px]:h-dvh max-[701px]:max-h-dvh',
  'max-[701px]:border-0 max-[701px]:rounded-none max-[701px]:translate-x-0 max-[701px]:translate-y-0',
].join(' ')

const Reader = lazy(async () => ({
  default: (await import('@/features/reader/document')).DocumentReader,
}))
export function DraftPreviewProvider({ workspace, children }: {
  /**
   * The provider reads only the live editor's snapshot, change feed, composing
   * flag and envelope; the editor workspace satisfies this.
   */
  workspace: { readonly model: PreviewModel }
  children: ReactNode
}): ReactNode {
  const [open, setOpen] = useState(false)
  const returnRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const show = useCallback((trigger: HTMLElement | null): void => {
    returnRef.current = trigger
    setOpen(true)
  }, [])
  const context = useMemo(() => ({ show }), [show])
  const text = useEditorLabels()
  return (
    <DraftPreviewContext value={context}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={previewDialogClass}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            closeRef.current?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const target = returnRef.current
            if (target?.isConnected === true) {
              target.focus({ preventScroll: true })
            }
            else {
              workspace.model.editor.focus()
            }
          }}
        >
          <header className={layout1Class}>
            <div>
              <DialogTitle>{text('Draft preview')}</DialogTitle>
              <DialogDescription>{text('Preview your current draft, including unsaved changes.')}</DialogDescription>
            </div>
            <DialogClose asChild>
              <Button ref={closeRef} type="button" size="icon" variant="ghost" aria-label={text('Close preview')}>
                <X size={20} aria-hidden="true" />
              </Button>
            </DialogClose>
          </header>
          <PreviewContent model={workspace.model} open={open} />
        </DialogContent>
      </Dialog>
    </DraftPreviewContext>
  )
}

export function LivePreview(): ReactNode {
  const preview = useDraftPreview()
  const text = useEditorLabels()
  return (
    <Button
      type="button"
      variant="outline"
      className="draft-preview-trigger justify-center gap-2 w-full"
      onClick={event =>
        preview.show(event.currentTarget)}
    >
      <Eye size={17} aria-hidden="true" />
      {text('Preview')}
    </Button>
  )
}

function PreviewContent({ model, open }: { model: PreviewModel, open: boolean }): ReactNode {
  const text = useEditorLabels()
  const { document, error } = usePreview(model, open)
  return (
    <div className={layout2Class} tabIndex={0} role="region" aria-label={text('Draft reader preview')}>
      {error !== ''
        ? (
            <p className="draft-preview-error m-0 text-destructive text-[length:14px]" role="alert">
              {text('Complete required fields to preview this draft.')}
            </p>
          )
        : (
            <Suspense fallback={<LoadingPreview />}>
              {document === null ? <LoadingPreview /> : <Reader document={document} privatePreview />}
            </Suspense>
          )}
    </div>
  )
}

function LoadingPreview(): ReactNode {
  const text = useEditorLabels()
  return (
    <div className="draft-preview-loading grid gap-4" role="status">
      <span className="sr-only">{text('Loading reader…')}</span>
      <PreviewSkeleton className="draft-preview-loading-title w-[65%] h-10 mb-4" />
      {Array.from({ length: 4 }, (_, index) => (
        <PreviewSkeleton key={index} className="draft-preview-loading-line h-[18px]" />
      ))}
    </div>
  )
}

function PreviewSkeleton({ className }: { className: string }): ReactNode {
  return (
    <div
      className={cn(
        'editor-loading-skeleton block w-full rounded-md bg-muted animate-pulse',
        'motion-reduce:animate-none',
        className,
      )}
      aria-hidden="true"
    />
  )
}
