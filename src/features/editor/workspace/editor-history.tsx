import type { ReactNode } from 'react'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import type { RevisionHistory } from '@/features/history/revision-history-model'
import type { BlogTranslator } from '@/i18n/instance'
import { AlertCircle, ArrowUpRight, Eye, LoaderCircle, RefreshCw, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { SettingSection } from '@/components/ui/ztd-me/ui/setting-section'
import { useRevisionHistory } from '@/features/history/revision-history-model'
import { RevisionSummary } from '@/features/history/revision-presentation'
import { EditorText } from '@/i18n/labels'
import { useBlogTranslation } from '@/i18n/use-translation'
import { ConfirmDialog } from '@/shared/admin/confirm-dialog'
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
} from './editor-history-layout'

const layout1Class = [
  utility1Class,
  '[&_.revision-toolbar]:min-h-9 [&_.revision-list]:gap-0 [&_.revision-list]:p-0',
  '[&_.revision-list]:list-none [&_.revision-list_>_li]:grid',
  '[&_.revision-list_>_li]:grid-cols-[minmax(0,_1fr)_auto]',
  '[&_.revision-list_>_li]:[align-items:start] [&_.revision-list_>_li]:gap-3',
  '[&_.revision-list_>_li]:py-[14px] [&_.revision-list_>_li]:border-t',
  '[&_.revision-list_>_li]:border-border [&_.revision-meta]:gap-[6px]',
  '[&_.revision-actions]:flex-nowrap [&_.revision-actions]:gap-0',
  '[&_.revision-actions_.ztd-button]:min-w-8 [&_.revision-actions_.ztd-button]:w-8',
  utility2Class,
  utility3Class,
  'max-[701px]:[&_.revision-actions_.ztd-button]:min-w-11',
  'max-[701px]:[&_.revision-actions_.ztd-button]:w-11',
  'max-[701px]:[&_.revision-actions_.ztd-button]:min-h-11',
].join(' ')

const layout2Class = [
  'revision-toolbar flex flex-wrap items-center gap-2 min-h-11 [&_>_button]:pl-0',
  utility4Class,
  '[&_.revision-open-history]:min-h-8 [&_.revision-open-history]:p-[6px]',
  utility5Class,
  utility6Class,
].join(' ')

const layout3Class = [utility7Class, 'wrap-anywhere flex items-center gap-[10px] [&_>_svg]:shrink-0'].join(' ')

const layout4Class = [
  utility8Class,
  utility9Class,
  'border-[color-mix(in_srgb,_var(--ztd-destructive)_40%,_var(--ztd-border))]',
  utility10Class,
  'gap-[10px] [&_>_svg]:shrink-0',
].join(' ')

const layout5Class = [utility11Class, '[&_li]:items-center [&_li]:gap-[6px]'].join(' ')

/**
 * What this panel consumes of the editor workspace.
 *
 * Only the opened document, the acknowledged head/live pair, the busy flag and
 * the runner are read, so the panel declares exactly those. A whole `Workspace`
 * still satisfies it; nothing here changes what the panel does at runtime.
 */
export type EditorHistoryWorkspace = {
  readonly props: Pick<Workspace['props'], 'initial'>
  readonly draft: Pick<Workspace['draft'], 'ack'>
  readonly busy: boolean
  readonly run: Workspace['run']
}

export function EditorHistory({
  workspace,
  restore,
}: {
  workspace: EditorHistoryWorkspace
  restore: (revision: string) => Promise<boolean>
}): ReactNode {
  const locale = useFrontendPreferences().preferences.locale
  const text = useBlogTranslation('editor').t
  const { history, loading, loaded, error, load } = useRevisionHistory(workspace.props.initial.documentId)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const restoreNotice = text('createdANewDraftRevisionThePublishedRevisionIsUnchanged')
  return (
    <SettingSection
      role="region"
      className={layout1Class}
      title={text('revisionHistory')}
      aria-label={text('revisionHistory')}
      aria-busy={loading}
      open={open}
      onOpenChange={(next: boolean) => {
        setOpen(next)
        if (next && !loaded && !loading) {
          workspace.run(load())
        }
      }}
    >
      <HistoryToolbar workspace={workspace} loading={loading} load={() => workspace.run(load())} />
      <HistoryLoadState
        loading={loading}
        loaded={loaded}
        error={error}
        empty={history.items.length === 0}
        text={text}
      />
      <HistoryItems history={history} workspace={workspace} setConfirm={setConfirm} locale={locale} />
      {history.nextBefore !== null && (
        <Button
          variant="outline"
          type="button"
          disabled={loading || workspace.busy}
          onClick={() => workspace.run(load(true))}
        >
          <EditorText value="Older revisions" />
        </Button>
      )}
      {confirm !== null && (
        <RestoreConfirmation
          revisionId={confirm}
          close={() => setConfirm(null)}
          restore={id => workspace.run(restore(id), restoreNotice)}
        />
      )}
    </SettingSection>
  )
}

function RestoreConfirmation({ revisionId, close, restore }: {
  revisionId: string
  close: () => void
  restore: (revisionId: string) => void
}): ReactNode {
  const text = useBlogTranslation('editor').t
  return (
    <ConfirmDialog
      title={text('restoreThisRevisionAsANewDraftTheLiveDocumentKeepsIts')}
      close={close}
      accept={() => {
        close()
        restore(revisionId)
      }}
    />
  )
}

function HistoryToolbar({ workspace, loading, load }: {
  workspace: EditorHistoryWorkspace
  loading: boolean
  load: () => void
}): ReactNode {
  const text = useBlogTranslation('editor').t
  return (
    <div className={layout2Class}>
      <Button variant="ghost" size="sm" type="button" disabled={loading || workspace.busy} onClick={load}>
        <RefreshCw size={16} aria-hidden="true" />
        {text('refreshHistory')}
      </Button>
      <Button asChild variant="ghost" size="icon" className="revision-open-history">
        <Link
          href={`/admin/documents/${workspace.props.initial.documentId}/history`}
          aria-label={text('viewAndCompareRevisions')}
          title={text('viewAndCompareRevisions')}
        >
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </Button>
    </div>
  )
}

function HistoryLoadState({
  loading,
  loaded,
  error,
  empty,
  text,
}: {
  loading: boolean
  loaded: boolean
  error: string
  empty: boolean
  text: BlogTranslator<'editor'>
}): ReactNode {
  if (loading) {
    return (
      <p className={layout3Class} role="status">
        <LoaderCircle size={16} className="revision-loading-icon" aria-hidden="true" />
        {text('loadingRevisions')}
      </p>
    )
  }
  if (error !== '') {
    return (
      <p className={layout4Class} role="alert">
        <AlertCircle size={16} aria-hidden="true" />
        {text('couldNotLoadRevisionsPleaseRetry')}
        {' '}
        <EditorText value={error} />
      </p>
    )
  }
  const message = loaded
    ? 'noSavedRevisionsYet'
    : 'loadHistoryToPreviewOrRestoreSavedRevisions'
  return empty ? <p className={utility12Class}>{text(message)}</p> : null
}

function HistoryItems({
  history,
  workspace,
  setConfirm,
  locale,
}: {
  history: RevisionHistory
  workspace: EditorHistoryWorkspace
  setConfirm: (id: string) => void
  locale: string
}): ReactNode {
  const text = useBlogTranslation('editor').t
  return (
    <ol className={layout5Class}>
      {history.items.map(revision => (
        <li key={revision.revisionId}>
          <RevisionSummary revision={revision} heads={workspace.draft.ack} locale={locale} text={text} />
          <div className="revision-actions flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="icon">
              <a
                href={`/admin/preview/${workspace.props.initial.documentId}/${revision.revisionId}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={text('preview')}
                title={text('preview')}
              >
                <Eye size={16} aria-hidden="true" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={text('restore')}
              title={text('restore')}
              disabled={workspace.busy || revision.revisionId === workspace.draft.ack.headRevisionId}
              onClick={(event) => {
                event.currentTarget.focus()
                setConfirm(revision.revisionId)
              }}
            >
              <RotateCcw size={16} aria-hidden="true" />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  )
}
