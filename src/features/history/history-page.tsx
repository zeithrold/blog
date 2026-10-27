'use client'
import type { ReactNode } from 'react'
import type { HistoryAction, HistoryModel, HistoryPageProps } from '@/features/history/history-page-model'
import type { BlogMessageKey, BlogTranslator } from '@/i18n/instance'
import { AlertCircle, ArrowLeft, LoaderCircle, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/ztd-me/client'
import { validateDocument } from '@/content/document'
import { publicationRequirements } from '@/content/publication-validation'
import { HistoryConfirmation } from '@/features/history/history-confirmation'
import { useHistoryPage } from '@/features/history/history-page-model'
import { RevisionSelection, SelectedActions } from '@/features/history/history-selection'
import { HistorySidebar } from '@/features/history/history-sidebar'
import { compareRevisions } from '@/features/history/revision-diff'
import { RevisionDiffView } from '@/features/history/revision-diff-view'
import { useBlogTranslation } from '@/i18n/use-translation'
import { background } from '@/shared/admin/background'
import { issueLabels } from '@/shared/admin/publication-issue-labels'
import { announceConfirmed } from '@/shared/admin/toast-feedback'
import {
  utility1Class,
  utility2Class,
  utility3Class,
  utility4Class,
  utility5Class,
  utility6Class,
  utility7Class,
  utility8Class,
  utility9Class,
  utility10Class,
  utility11Class,
  utility12Class,
  utility13Class,
  utility14Class,
  utility15Class,
  utility16Class,
  utility17Class,
  utility18Class,
  utility19Class,
  utility20Class,
} from './history-page-utilities'

const layout1Class = [
  utility1Class,
  utility2Class,
  utility3Class,
  '[&_.admin-heading_p]:mb-0 [&_.admin-heading_p]:text-muted-foreground',
  '[&_.admin-heading_p]:text-[length:14px] [&_.admin-heading_p]:wrap-anywhere',
  '[&_.history-layout]:grid-cols-[260px_minmax(0,_1fr)] [&_.history-layout]:gap-8',
  '[&_.history-sidebar]:sticky [&_.history-sidebar]:top-6 [&_.history-sidebar]:grid',
  utility4Class,
  '[&_.history-sidebar]:border-border',
  'max-[1100px]:[&_.history-layout]:grid-cols-[220px_minmax(0,_1fr)]',
  utility5Class,
  'max-[701px]:[&_.history-layout]:gap-0 max-[701px]:[&_.history-sidebar]:hidden',
  utility6Class,
  'max-[701px]:[&_.admin-heading_>_button]:[align-self:flex-end]',
  utility7Class,
  'max-[701px]:[&_.admin-heading_>_button]:px-[10px]',
  'max-[701px]:[&_.admin-heading_>_button]:text-[length:13px] max-[1023.99px]:px-6',
  'max-[639.99px]:pt-8 max-[639.99px]:px-4 max-[639.99px]:pb-14',
].join(' ')

const layout2Class = [
  utility8Class,
  'my-4 mx-0 py-3 px-4 border rounded-[12px] text-help leading-[1.6]',
  'border-[color-mix(in_srgb,_var(--ztd-destructive)_40%,_var(--ztd-border))]',
  utility9Class,
  'gap-[10px] [&_>_svg]:shrink-0',
].join(' ')

const layout3Class = [
  'history-layout grid [align-items:start] gap-6 grid-cols-[290px_minmax(0,_1fr)]',
  'max-[960px]:grid-cols-[minmax(0,_1fr)]',
].join(' ')

const layout4Class = [
  'history-main grid gap-5 min-w-0',
  '[&_.history-selection]:grid-cols-[minmax(0,_1fr)_minmax(200px,_0.7fr)]',
  utility10Class,
  utility11Class,
  'max-[1100px]:[&_.history-selection]:grid-cols-[minmax(0,_1fr)]',
  utility12Class,
].join(' ')

const layout5Class = [utility13Class, 'rounded-[12px] text-muted-foreground text-center'].join(' ')

const layout6Class = [
  utility14Class,
  utility15Class,
  utility16Class,
  utility17Class,
].join(' ')

const layout7Class = [
  utility18Class,
  'no-underline hover:text-foreground [&_svg]:[transition:transform_0.2s]',
  '[&:hover_svg]:transform-[translateX(-2px)]',
].join(' ')

const layout8Class = [
  'm-0 text-[clamp(44px,6vw,68px)] font-medium tracking-[-0.045em] leading-[1.08]',
  '[html:lang(zh-CN)_&]:tracking-[-0.02em] [html:lang(zh-CN)_&]:leading-[1.2]',
].join(' ')

const layout9Class = [
  utility19Class,
  utility20Class,
  'gap-[10px] [&_>_svg]:shrink-0',
].join(' ')

export function HistoryPage(props: HistoryPageProps): ReactNode {
  const model = useHistoryPage(props)
  const text = useBlogTranslation('editor').t
  const [confirm, setConfirm] = useState<HistoryAction | null>(null)
  const difference = useMemo(
    () => compareRevisions(model.baseline.document, model.selected.document),
    [model.baseline.document, model.selected.document],
  )
  const issues = useMemo(() => publicationRequirements(model.selected.document), [model.selected.document])
  const publishable = useMemo(() => canPublish(model.selected.document), [model.selected.document])
  return (
    <section className={layout1Class} aria-busy={model.busy || model.loading}>
      <HistoryHeader model={model} text={text} />
      <HistoryError model={model} text={text} />
      <HistoryNotice model={model} text={text} />
      <div className={layout3Class}>
        <HistorySidebar model={model} text={text} />
        <div className={layout4Class}>
          <RevisionSelection model={model} text={text} />
          <SelectedActions model={model} text={text} publishable={publishable} issues={issues} confirm={setConfirm} />
          {model.loading
            ? (
                <div className={layout5Class} role="status">
                  <LoaderCircle size={20} className="revision-loading-icon" aria-hidden="true" />
                  {text('loadingRevision')}
                </div>
              )
            : (
                <RevisionDiffView
                  key={`${model.baseline.revisionId}:${model.selected.revisionId}`}
                  difference={difference}
                />
              )}
        </div>
      </div>
      {confirm !== null && (
        <HistoryConfirmation
          model={model}
          action={confirm}
          text={text}
          close={() => setConfirm(null)}
          accept={() => {
            const action = confirm
            setConfirm(null)
            const task = model.perform(action)
            background(task, () => {})
            announceConfirmed(
              task,
              text(action === 'restore'
                ? 'createdANewDraftRevisionThePublishedRevisionIsUnchanged'
                : 'publishedTheSelectedRevisionTheDraftRevisionIsUnchanged'),
            )
          }}
        />
      )}
    </section>
  )
}

function HistoryError({ model, text }: { model: HistoryModel, text: BlogTranslator<'editor'> }): ReactNode {
  if (model.error === '') {
    return null
  }
  return (
    <div role="alert" className={layout2Class}>
      <AlertCircle size={18} aria-hidden="true" />
      <div>
        <p className="m-0">{historyErrorMessage(model.error, text)}</p>
        {model.errorIssues.length > 0 && (
          <ul className="mb-0 mt-2 list-disc space-y-1 pl-5">
            {model.errorIssues.map(issue => <li key={issue}>{text(issueLabels[issue])}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

function HistoryHeader({ model, text }: { model: HistoryModel, text: BlogTranslator<'editor'> }): ReactNode {
  return (
    <header className={layout6Class}>
      <div>
        <Link className={layout7Class} href={`/admin/documents/${model.current.documentId}`}>
          <ArrowLeft size={15} aria-hidden="true" />
          {text('backToEditor')}
        </Link>
        <h1 className={layout8Class}>{text('revisionHistory')}</h1>
        <p>{documentTitle(model.current.document.meta.title, text)}</p>
      </div>
      <Button
        variant="outline"
        type="button"
        disabled={model.busy || model.loading}
        onClick={() => background(model.refresh(), () => {})}
      >
        <RefreshCw size={16} aria-hidden="true" />
        {text('refreshHistory')}
      </Button>
    </header>
  )
}
function HistoryNotice({ model, text }: { model: HistoryModel, text: BlogTranslator<'editor'> }): ReactNode {
  return model.notice === null
    ? null
    : (
        <p role="status" className={layout9Class}>
          <AlertCircle size={18} aria-hidden="true" />
          {text('anotherTabChangedThisDocumentReviewTheLatest')}
        </p>
      )
}
function documentTitle(title: string, text: BlogTranslator<'editor'>): string {
  if (title !== '') {
    return title
  }
  return text('untitled')
}
function historyErrorMessage(code: string, text: BlogTranslator<'editor'>): string {
  const messages: Record<string, BlogMessageKey<'editor'>> = {
    HISTORY_REFRESH_REQUIRED: 'refreshHistoryBeforeContinuing',
    HISTORY_OUTCOME_UNKNOWN: 'historyOperationOutcomeUnknown',
    PUBLICATION_CONFLICT: 'thePublicURLOrSeriesPositionIsAlreadyInUseEditThe',
    INVALID_DOCUMENT: 'thisRevisionDoesNotMeetPublicationRequirementsRestoreItAsADraft',
    PUBLICATION_INVALID: 'thisRevisionDoesNotMeetPublicationRequirementsRestoreItAsADraft',
    MAINTENANCE: 'writesArePausedForMaintenanceRetryAfterMaintenanceEnds',
    OWNER_REQUIRED: 'yourSessionCannotManageThisDocumentSignInAsTheOwner',
  }
  const fallback = text('couldNotCompleteTheOperationCheckYourConnectionOrSignInAnd')
  return messages[code] === undefined ? fallback : text(messages[code])
}
function canPublish(document: HistoryModel['selected']['document']): boolean {
  try {
    validateDocument(document, true)
    return true
  }
  catch {
    return false
  }
}
