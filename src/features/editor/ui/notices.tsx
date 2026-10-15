import type { ReactNode } from 'react'
import type { Workspace } from '@/features/editor/core/editor-types'
import type { Recovery } from '@/features/editor/core/recovery'
import type { OpenDocument } from '@/features/editor/services/api-client'
import { Clock3, GitMerge, RotateCcw, X } from 'lucide-react'
import { Button, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { keepLocalRevision } from '@/features/editor/core/conflict-resolution'
import { useConflictResolution, useNotices } from '@/features/editor/services/notices-model'
import { ConfirmDialog } from '@/features/editor/ui/confirm'
import { ConflictActions } from '@/features/editor/ui/conflict-actions'
import { ConflictComparison } from '@/features/editor/ui/conflict-comparison'
import { DraftErrorNotice, PublicationErrorNotice } from '@/features/editor/ui/draft-error-notice'
import { EditorNotice } from '@/features/editor/ui/notice-shell'
import { EditorText } from '@/i18n/labels'
import { useEditorLabels } from '@/i18n/use-labels'
import { useBlogTranslation } from '@/i18n/use-translation'

const utility1Class = [
  'editor-notice-meta flex flex-wrap items-center gap-y-1 gap-x-[6px] mt-[6px] mx-0 mb-0',
].join(' ')

const utility2Class = ['text-muted-foreground text-[length:12px] [&_time]:tabular-nums [&_>_svg]:shrink-0'].join(' ')

const utility3Class = ['editor-notice-actions flex flex-wrap items-center gap-2 mt-3 [&_>_button]:max-w-full'].join(' ')

const utility4Class = [
  '[&_>_button]:h-auto [&_>_button]:min-h-9 [&_>_button]:py-[7px] [&_>_button]:px-[10px]',
].join(' ')

const utility5Class = [
  '[&_>_button]:text-[length:13px] [&_>_button]:whitespace-normal [&_>_button_>_svg]:shrink-0',
].join(' ')

const layout1Class = [utility1Class, utility2Class].join(' ')

const layout2Class = [
  utility3Class,
  utility4Class,
  utility5Class,
  'max-[701px]:[&_>_button]:min-h-11',
].join(' ')

export function DraftNotices({
  workspace,
  setResolving,
}: {
  workspace: Workspace
  setResolving: (busy: boolean) => void
}): ReactNode {
  const { local, setLocal, remote, confirm, setConfirm, refreshRemote } = useNotices(workspace)
  const text = useBlogTranslation('editor').t
  const resolve = useConflictResolution(workspace, setResolving, refreshRemote)
  return (
    <>
      <DraftErrorNotice
        error={workspace.draft.error}
        conflictShown={remote !== null && workspace.draft.status === 'conflict'}
      />
      {workspace.draft.rejection !== null && (
        <PublicationErrorNotice workspace={workspace} rejection={workspace.draft.rejection} />
      )}
      {local !== null && (
        <RecoveryNotice workspace={workspace} local={local} dismiss={() => setLocal(null)} />
      )}
      {remote !== null && workspace.draft.status === 'conflict' && (
        <ConflictNotice
          workspace={workspace}
          remote={remote}
          confirm={() => setConfirm(true)}
          openServer={() => resolve(async () => {
            if (await workspace.draft.persistLocal()) {
              workspace.props.reopen(remote)
            }
          })}
        />
      )}
      {confirm && remote !== null && (
        <ConfirmDialog
          title={text('replaceTheServerDraftWithThisLocalContent')}
          close={() => setConfirm(false)}
          accept={() => {
            setConfirm(false)
            resolve(async () => await keepLocalRevision({
              snapshot: workspace.model.snapshot,
              client: workspace.draft.client,
              coordinator: workspace.draft.coordinator,
            }, remote))
          }}
        />
      )}
    </>
  )
}
function RecoveryNotice({
  workspace,
  local,
  dismiss,
}: {
  workspace: Workspace
  local: Recovery
  dismiss: () => void
}): ReactNode {
  const locale = useFrontendPreferences().preferences.locale
  const text = useBlogTranslation('editor').t
  const labels = useEditorLabels()
  const savedAt = new Date(local.savedAt)
  return (
    <EditorNotice title={text('localRecoveryCopy')} icon={<RotateCcw size={18} />} tone="recovery">
      <p className="editor-notice-description m-0 text-muted-foreground wrap-anywhere">
        {text('localRecoveryCopyDescription')}
      </p>
      <p className={layout1Class}>
        <Clock3 size={13} aria-hidden="true" />
        <span>{labels('Saved')}</span>
        <time dateTime={savedAt.toISOString()}>
          {savedAt.toLocaleString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </p>
      <RecoveryActions workspace={workspace} local={local} dismiss={dismiss} />
    </EditorNotice>
  )
}
function RecoveryActions({ workspace, local, dismiss }: {
  workspace: Workspace
  local: Recovery
  dismiss: () => void
}): ReactNode {
  return (
    <div className={layout2Class}>
      <Button
        variant="outline"
        size="sm"
        type="button"
        disabled={workspace.busy}
        onClick={() =>
          workspace.props.reopen(
            {
              ...workspace.props.initial,
              headRevisionId: local.baseRevisionId,
              document: local.document,
            },
            true,
          )}
      >
        <RotateCcw size={15} aria-hidden="true" />
        <EditorText value="Open recovered draft" />
      </Button>
      <Button variant="ghost" size="sm" type="button" disabled={workspace.busy} onClick={dismiss}>
        <X size={15} aria-hidden="true" />
        <EditorText value="Dismiss" />
      </Button>
    </div>
  )
}
function ConflictNotice({
  workspace,
  remote,
  confirm,
  openServer,
}: {
  workspace: Workspace
  remote: OpenDocument
  confirm: () => void
  openServer: () => void
}): ReactNode {
  const text = useBlogTranslation('editor').t
  return (
    <EditorNotice title={text('draftConflict')} icon={<GitMerge size={18} />} tone="conflict">
      <p className="editor-notice-description m-0 text-muted-foreground wrap-anywhere">
        {text('draftConflictDescription')}
      </p>
      <ConflictComparison key={remote.headRevisionId} workspace={workspace} remote={remote} />
      <ConflictActions workspace={workspace} confirm={confirm} openServer={openServer} />
    </EditorNotice>
  )
}
