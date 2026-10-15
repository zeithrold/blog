import type { ReactNode } from 'react'
import type { PublicationIssue } from '@/content/publication-issues'
import type { HistoryAction, HistoryModel } from '@/features/history/history-page-model'
import type { BlogTranslator } from '@/i18n/instance'
import { Eye, RotateCcw, Send } from 'lucide-react'
import { ChoiceSelect } from '@/components/ui/choice-select'
import { Button, Label } from '@/components/ui/ztd-me/client'
import { background } from '@/features/editor/core/tasks'
import { issueLabels } from '@/features/editor/ui/publication-issue-labels'
import { HistoryMore } from '@/features/history/history-sidebar'
import { revisionLabel, revisionOptions } from '@/features/history/revision-labels'
import { RevisionState } from '@/features/history/revision-presentation'

const utility1Class = [
  'history-selected-heading [&_p]:m-0 [&_p]:text-muted-foreground [&_p]:text-[length:14px]',
].join(' ')

const utility2Class = [
  '[&_p]:wrap-anywhere grid gap-2 min-w-0 [&_>_div]:flex [&_>_div]:flex-wrap',
  '[&_>_div]:items-center',
].join(' ')

const utility3Class = [
  '[&_>_div]:gap-[10px] [&_h2]:m-0 [&_h2]:text-[length:20px] [&_h2]:font-semibold',
  'max-[701px]:hidden',
].join(' ')

const utility4Class = [
  'history-actions grid gap-4 [&_.ztd-button]:text-[length:13px] [&_.ztd-button]:no-underline',
].join(' ')

const utility5Class = [
  'max-[701px]:[&_.actions]:grid',
  'max-[701px]:[&_.actions]:grid-cols-[minmax(0,_1fr)_minmax(0,_1fr)]',
].join(' ')

const utility6Class = [
  'max-[701px]:[&_.actions_>_a]:[grid-column:1_/_-1] max-[701px]:[&_.ztd-button]:min-w-0',
].join(' ')

const utility7Class = [
  'max-[701px]:[&_.ztd-button]:text-[length:12px] max-[701px]:[&_.ztd-button]:whitespace-normal',
].join(' ')

const utility8Class = ['editor-field-help m-0 text-muted-foreground text-help leading-[1.65] wrap-anywhere'].join(' ')

const layout1Class = [
  'history-selection grid gap-4 [&_.ztd-label]:text-muted-foreground',
  '[&_.ztd-label]:text-[length:12px] [&_.ztd-label]:font-normal',
].join(' ')

const layout2Class = [
  utility1Class,
  utility2Class,
  utility3Class,
].join(' ')

const layout3Class = [
  utility4Class,
  '[&_p]:m-0 [&_.actions]:flex [&_.actions]:flex-wrap [&_.actions]:gap-2',
  utility5Class,
  utility6Class,
  'max-[701px]:[&_.ztd-button]:min-h-11 max-[701px]:[&_.ztd-button]:px-2',
  utility7Class,
].join(' ')

export function RevisionSelection({ model, text }: { model: HistoryModel, text: BlogTranslator<'editor'> }): ReactNode {
  const options = revisionOptions(model, text)
  return (
    <div className={layout1Class} data-selected-revision={model.selected.revisionId}>
      <div className={layout2Class}>
        <span className="history-eyebrow text-muted-foreground text-[length:12px]">{text('selectedRevision')}</span>
        <div>
          <h2>{revisionLabel(model.selected.revisionId, model, text)}</h2>
          <RevisionState id={model.selected.revisionId} heads={model.current} text={text} />
        </div>
        <p>{model.selected.document.meta.title === '' ? text('untitled') : model.selected.document.meta.title}</p>
      </div>
      <div className="history-selection-controls grid gap-3 min-w-0 max-[701px]:gap-[14px]">
        <div className="history-mobile-selection gap-2 min-w-0 hidden max-[701px]:grid">
          <Label className="grid gap-2" htmlFor="history-selected-revision">{text('selectedRevision')}</Label>
          <ChoiceSelect
            id="history-selected-revision"
            label={text('selectedRevision')}
            value={model.selected.revisionId}
            disabled={model.busy || model.loading || model.refreshRequired}
            onValueChange={value => background(model.choose(value, 'selected'), () => {})}
            options={options}
          />
        </div>
        <div className="history-baseline-selection grid gap-2 min-w-0">
          <Label className="grid gap-2" htmlFor="history-baseline-revision">{text('compareAgainst')}</Label>
          <ChoiceSelect
            id="history-baseline-revision"
            label={text('compareAgainst')}
            value={model.baseline.revisionId}
            disabled={model.busy || model.loading || model.refreshRequired}
            onValueChange={value => background(model.choose(value, 'baseline'), () => {})}
            options={options}
          />
        </div>
      </div>
      {model.history.nextBefore !== null && (
        <div className="history-mobile-more hidden max-[701px]:grid"><HistoryMore model={model} text={text} /></div>
      )}
    </div>
  )
}

export function SelectedActions({ model, text, publishable, issues, confirm }: {
  model: HistoryModel
  text: BlogTranslator<'editor'>
  publishable: boolean
  issues: PublicationIssue[]
  confirm: (value: HistoryAction) => void
}): ReactNode {
  const disabled = model.busy || model.loading || model.refreshRequired
  return (
    <section className={layout3Class}>
      <div className="actions flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <a
            href={`/admin/preview/${model.current.documentId}/${model.selected.revisionId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Eye size={15} aria-hidden="true" />
            {text('previewSelectedRevision')}
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={disabled || model.selected.revisionId === model.current.headRevisionId}
          onClick={(event) => {
            event.currentTarget.focus()
            confirm('restore')
          }}
        >
          <RotateCcw size={15} aria-hidden="true" />
          {text('restoreAsNewDraft')}
        </Button>
        <Button
          variant="default"
          size="sm"
          type="button"
          disabled={disabled || !publishable || model.selected.revisionId === model.current.liveRevisionId}
          onClick={(event) => {
            event.currentTarget.focus()
            confirm('publish')
          }}
        >
          <Send size={15} aria-hidden="true" />
          {text('publishSelectedRevision')}
        </Button>
      </div>
      {!publishable && (
        <div className="history-publication-requirements">
          <p className={utility8Class}>{text('thisRevisionDoesNotMeetPublicationRequirementsRestoreItAsADraft')}</p>
          <ul className="m-0 mt-2 list-disc space-y-1 pl-5 text-help text-muted-foreground">
            {issues.map(issue => <li key={issue}>{text(issueLabels[issue])}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}
