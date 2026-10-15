import type { ReactNode } from 'react'
import type { HistoryAction, HistoryModel } from '@/features/history/history-page-model'
import type { BlogTranslator } from '@/i18n/instance'
import { useRef } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ztd-me/client'
import { revisionLabel } from '@/features/history/revision-labels'
import { RevisionState } from '@/features/history/revision-presentation'

const utility1Class = ['history-confirmation-revision [&_p]:m-0 [&_p]:text-[length:14px] [&_p]:font-medium'].join(' ')

const utility2Class = [
  '[&_p]:wrap-anywhere grid gap-2 p-4 border border-border rounded-[8px] bg-muted [&_>_div]:flex',
].join(' ')

const utility3Class = [
  '[&_>_div]:flex-wrap [&_>_div]:items-center [&_>_div]:gap-[10px]',
  '[&_>_div]:text-muted-foreground',
].join(' ')

const layout1Class = [
  utility1Class,
  utility2Class,
  utility3Class,
  '[&_>_div]:text-[length:13px]',
].join(' ')

export function HistoryConfirmation({ model, action, text, close, accept }: {
  model: HistoryModel
  action: HistoryAction
  text: BlogTranslator<'editor'>
  close: () => void
  accept: () => void
}): ReactNode {
  const priorRef = useRef<Element | null>(null)
  const messages = confirmationText(action, text)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          close()
        }
      }}
    >
      <DialogContent
        className="history-confirmation"
        onOpenAutoFocus={() => { priorRef.current = document.activeElement }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (priorRef.current instanceof HTMLElement && priorRef.current.isConnected) {
            priorRef.current.focus()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{messages.title}</DialogTitle>
          <DialogDescription>{messages.description}</DialogDescription>
        </DialogHeader>
        <div className={layout1Class} data-revision-id={model.selected.revisionId}>
          <p>{documentTitle(model.selected.document.meta.title, text)}</p>
          <div>
            <span>{revisionLabel(model.selected.revisionId, model, text)}</span>
            <RevisionState id={model.selected.revisionId} heads={model.current} text={text} />
          </div>
        </div>
        {action === 'publish' && <PublishPath model={model} text={text} />}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>{text('cancel')}</Button>
          <Button type="button" onClick={accept}>{text('confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
function confirmationText(action: HistoryAction, text: BlogTranslator<'editor'>): {
  title: string
  description: string
} {
  if (action === 'restore') {
    return {
      title: text('restoreThisRevisionAsANewDraft'),
      description: text('createsANewImmutableDraftRevisionPublishedContentStaysUnchanged'),
    }
  }
  return {
    title: text('publishThisRevision'),
    description: text('replacesPublishedContentAndKeepsTheDraftPublicationRulesAndMediaAre'),
  }
}
function documentTitle(title: string, text: BlogTranslator<'editor'>): string {
  if (title !== '') {
    return title
  }
  return text('untitled')
}
function PublishPath({ model, text }: { model: HistoryModel, text: BlogTranslator<'editor'> }): ReactNode {
  const path = `/${model.current.kind === 'article' ? 'posts' : 'pages'}/${model.selected.document.meta.slug}`
  return (
    <>
      <p>
        {text('publicURL')}
        :
        {' '}
        <code>{path}</code>
      </p>
      {model.current.livePath !== null && model.current.livePath !== path && (
        <p role="alert">
          {text('thePreviousPublicURLWillStopWorkingNoAutomaticRedirectIsCreated')}
          {' '}
          <code>{model.current.livePath}</code>
        </p>
      )}
    </>
  )
}
