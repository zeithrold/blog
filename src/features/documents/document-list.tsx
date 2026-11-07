'use client'
import type { ReactNode } from 'react'
import type { ListProps } from './document-list-types'
import type { DocumentListCopy } from '@/features/documents/document-list-copy'
import type { DocumentEntry, DocumentsState } from '@/features/documents/document-list-model'
import {
  ArrowUpRight,
  CalendarClock,
  FilePlus2,
  FileText,
  PenLine,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { Button, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { hasDocumentFilters } from '@/content/document-list-query'
import { documentListError, useDocumentListCopy } from '@/features/documents/document-list-copy'
import { DocumentFiltersForm, DocumentListSummary } from '@/features/documents/document-list-filters'
import { documentPublication, useDocuments } from '@/features/documents/document-list-model'
import { background } from '@/shared/admin/background'
import { announceConfirmed } from '@/shared/admin/toast-feedback'
import { DocumentLoading, DocumentPagination } from './document-list-footer'
import {
  layout1Class,
  layout2Class,
  layout3Class,
  layout4Class,
  layout5Class,
  layout7Class,
  layout8Class,
  layout9Class,
  layout10Class,
  layout11Class,
  layout12Class,
  layout13Class,
  layout14Class,
  layout15Class,
  layout16Class,
} from './document-list-layout'
import { utility1Class } from './document-list-utilities'

export function DocumentList({ csrfToken }: { csrfToken: string }): ReactNode {
  const { controller, state } = useDocuments(csrfToken)
  const locale = useFrontendPreferences().preferences.locale
  const copy = useDocumentListCopy()
  const props = { controller, state, copy }
  return (
    <section className={layout1Class} data-trash={state.filters.state === 'deleted'}>
      <DocumentListHeader {...props} />
      <DocumentFiltersForm {...props} />
      <DocumentListSummary {...props} />
      <DocumentListNotices {...props} />
      <div className={layout2Class} aria-busy={state.loading !== null}>
        {state.loading === 'list' && <DocumentLoading copy={copy} initial={!state.loaded} />}
        {state.entries.length > 0 && <DocumentRows {...props} locale={locale} />}
        {state.loaded && state.entries.length === 0 && state.loading === null
          && state.error === null && <EmptyDocuments {...props} />}
      </div>
      <DocumentPagination {...props} />
    </section>
  )
}

function DocumentListHeader({ controller, state, copy }: ListProps): ReactNode {
  return (
    <header className={layout3Class}>
      <div>
        <h1 className={layout4Class}>{copy.title}</h1>
        <p className={[utility1Class, 'leading-[1.6]'].join(' ')}>
          {copy.description}
        </p>
      </div>
      <div className="actions flex flex-wrap items-center gap-2">
        <Button
          variant="default"
          type="button"
          disabled={state.mutation !== null}
          onClick={() => background(controller.create('article'), () => {})}
        >
          <FilePlus2 aria-hidden="true" size={17} />
          {state.mutation === 'article' ? copy.creating : copy.newPost}
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={state.mutation !== null}
          onClick={() => background(controller.create('page'), () => {})}
        >
          <FileText aria-hidden="true" size={17} />
          {state.mutation === 'page' ? copy.creating : copy.newPage}
        </Button>
      </div>
    </header>
  )
}

function DocumentListNotices({ controller, state, copy }: ListProps): ReactNode {
  const pending = state.loading !== null || state.mutation !== null
  const { errorCode } = state
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const notice = errorRef.current
    if (notice !== null) {
      notice.focus({ preventScroll: true })
      notice.scrollIntoView({ block: 'center' })
    }
  }, [state.error, errorCode])
  return (
    <>
      {state.error !== null && (
        <div ref={errorRef} role="alert" tabIndex={-1} className={layout5Class}>
          <p>{documentListError(state, copy)}</p>
          <Button
            variant="outline"
            type="button"
            disabled={pending}
            onClick={() => announceConfirmed(controller.retry(), copy.restored)}
          >
            {state.errorCode === 'EDIT_CONFLICT' ? copy.refresh : copy.retry}
          </Button>
        </div>
      )}
      {state.filters.state === 'deleted' && <p className="document-trash-hint">{copy.trashHint}</p>}
    </>
  )
}

function EmptyDocuments({ state, copy }: ListProps): ReactNode {
  const trash = state.filters.state === 'deleted'
  const { title, description } = emptyCopy(state, copy)
  return (
    <div className={layout7Class}>
      <span
        className={[
          'empty-icon flex items-center justify-center w-11 h-11 rounded-[10px] bg-muted',
          'text-muted-foreground',
        ].join(' ')}
        aria-hidden="true"
      >
        {trash ? <Trash2 size={22} /> : <PenLine size={22} />}
      </span>
      <div>
        <p className="empty-title">{title}</p>
        <p>{description}</p>
      </div>
    </div>
  )
}

function emptyCopy(state: DocumentsState, copy: DocumentListCopy): { title: string, description: string } {
  if (state.filters.state === 'deleted' && state.filters.q === '' && state.filters.kind === 'all') {
    return { title: copy.emptyTrash, description: copy.emptyTrashDescription }
  }
  if (hasDocumentFilters(state.filters)) {
    return { title: copy.noMatches, description: copy.noMatchesDescription }
  }
  return { title: copy.emptyTitle, description: copy.emptyDescription }
}

function DocumentRows({ controller, state, copy, locale }: ListProps & { locale: string }): ReactNode {
  return (
    <>
      <div className={layout8Class} aria-hidden="true">
        <span>{copy.document}</span>
        <span>{copy.kind}</span>
        <span>{copy.state}</span>
        <span>{copy.updated}</span>
        <span />
      </div>
      <ul className={layout9Class} aria-label={copy.title}>
        {state.entries.map(entry => (
          <DocumentRow key={entry.documentId} entry={entry} {...{ controller, state, copy, locale }} />
        ))}
      </ul>
    </>
  )
}

function DocumentRow({ entry, controller, state, copy, locale }: ListProps & {
  entry: DocumentEntry
  locale: string
}): ReactNode {
  const updated = new Date(entry.updatedAt)
  const publication = documentPublication(entry)
  const trash = state.filters.state === 'deleted'
  const badgeState = publication === 'published' ? 'live' : publication
  const title = entry.title !== '' ? entry.title : copy.untitled
  const titleId = useId()
  return (
    <li className={layout10Class}>
      <div className="document-row-heading flex items-center gap-3 min-w-0 max-[701px]:basis-full">
        <span className={layout11Class} aria-hidden="true">
          {entry.kind === 'page' ? <FileText size={16} /> : <PenLine size={16} />}
        </span>
        {trash
          ? (
              <span id={titleId} className={layout12Class}>
                {title}
              </span>
            )
          : (
              <a id={titleId} className={layout13Class} href={`/admin/documents/${entry.documentId}`}>
                {title}
              </a>
            )}
      </div>
      <span className="document-kind text-muted-foreground text-help">{copy[entry.kind]}</span>
      <div className="document-publication grid gap-[6px] py-2">
        <span className={layout14Class} data-state={trash ? 'deleted' : badgeState}>
          {trash ? copy.deleted : copy[publication]}
        </span>
        <DocumentSchedule entry={entry} copy={copy} locale={locale} />
      </div>
      <time className={layout15Class} dateTime={updated.toISOString()}>
        {updated.toLocaleDateString(locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </time>
      <DocumentRowAction entry={entry} titleId={titleId} {...{ controller, state, copy }} />
    </li>
  )
}

function DocumentSchedule({ entry, copy, locale }: {
  entry: DocumentEntry
  copy: DocumentListCopy
  locale: string
}): ReactNode {
  const schedule = entry.pendingSchedule
  if (schedule === null || schedule === undefined) {
    return null
  }
  const date = new Date(schedule.runAt)
  return (
    <>
      <span className="document-schedule-badge whitespace-normal leading-[1.5]">
        <CalendarClock size={13} aria-hidden="true" />
        {copy.scheduled}
        {' · '}
        <time dateTime={date.toISOString()}>
          {date.toLocaleString(locale, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
          })}
        </time>
      </span>
      {schedule.revisionId !== entry.headRevisionId && (
        <span className="document-schedule-note text-muted-foreground text-help">{copy.earlierScheduled}</span>
      )}
    </>
  )
}

function DocumentRowAction({ entry, titleId, controller, state, copy }: ListProps & {
  entry: DocumentEntry
  titleId: string
}): ReactNode {
  if (state.filters.state !== 'deleted') {
    return (
      <ArrowUpRight className={layout16Class} size={16} aria-hidden="true" />
    )
  }
  return (
    <Button
      variant="outline"
      type="button"
      className="document-restore"
      aria-describedby={titleId}
      disabled={state.mutation !== null || state.loading !== null}
      onClick={() => announceConfirmed(controller.restore(entry), copy.restored)}
    >
      <Undo2 size={15} aria-hidden="true" />
      {state.mutation === entry.documentId ? copy.restoring : copy.restore}
    </Button>
  )
}
