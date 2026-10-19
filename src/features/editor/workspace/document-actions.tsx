import type { ReactNode } from 'react'
import type { DocumentAction } from '@/features/editor/workspace/document-actions-panel'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import type { UiText } from '@/i18n/use-translation'
import { ArrowUpRight, Eye, History, RefreshCw, Trash2, Undo2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useDraftPreview } from '@/features/editor/preview/draft-preview-context'
import { DocumentActionsPanel } from '@/features/editor/workspace/document-actions-panel'
import { useCompactLayout } from '@/hooks/use-compact-layout'
import { useEditorLabels } from '@/i18n/use-labels'
import { ConfirmDialog } from '@/shared/admin/confirm-dialog'

type Confirmation = 'unpublish' | 'delete'
type Props = {
  workspace: Workspace
  publish: (unpublish?: boolean) => Promise<void>
  remove: () => Promise<void>
  livePath: string | null
}

export function DocumentActions({ workspace, publish, remove, livePath }: Props): ReactNode {
  const text = useEditorLabels()
  const mobile = useCompactLayout(700)
  const panel = useActionPanel(mobile)
  const unpublished = workspace.draft.ack.liveRevisionId === null
  const [sync, ...links] = documentActions(workspace, livePath, text)
  const actions = [
    ...(sync === undefined ? [] : [sync]),
    { label: text('Preview'), icon: Eye, select: panel.requestPreview },
    ...links,
    {
      label: text(unpublished ? 'Delete document' : 'Unpublish'),
      icon: unpublished ? Trash2 : Undo2,
      destructive: true,
      disabled: workspace.busy,
      select: () => panel.requestConfirmation(unpublished ? 'delete' : 'unpublish'),
    },
  ]
  return (
    <>
      <DocumentActionsPanel
        mobile={mobile}
        open={panel.open}
        changeOpen={panel.changeOpen}
        afterClose={panel.afterClose}
        triggerRef={panel.triggerRef}
        busy={workspace.busy}
        actions={actions}
        description={text('Drafts save automatically. Sync now sends pending changes immediately.')}
      />
      {panel.confirm !== null && (
        <DocumentConfirmation
          {...{ workspace, publish, remove }}
          confirmation={panel.confirm}
          close={panel.closeConfirmation}
          returnFocus={() => panel.triggerRef.current}
        />
      )}
    </>
  )
}

function useActionPanel(mobile: boolean) {
  const [panel, setPanel] = useState({ mobile, open: false })
  const [confirm, setConfirm] = useState<Confirmation | null>(null)
  const pendingConfirmationRef = useRef<Confirmation | null>(null)
  const pendingPreviewRef = useRef(false)
  const preview = useDraftPreview()
  const triggerRef = useRef<HTMLButtonElement>(null)
  if (panel.mobile !== mobile) {
    setPanel({ mobile, open: false })
  }
  const requestConfirmation = (confirmation: Confirmation): boolean => {
    pendingConfirmationRef.current = confirmation
    return true
  }
  const requestPreview = (): boolean => {
    pendingPreviewRef.current = true
    return true
  }
  const afterClose = (event: Event): void => {
    if (pendingPreviewRef.current) {
      pendingPreviewRef.current = false
      event.preventDefault()
      preview.show(triggerRef.current)
      return
    }
    const pending = pendingConfirmationRef.current
    pendingConfirmationRef.current = null
    if (pending !== null) {
      event.preventDefault()
      setConfirm(pending)
    }
    else if (mobile) {
      event.preventDefault()
      triggerRef.current?.focus()
    }
  }
  return {
    open: panel.mobile === mobile && panel.open,
    changeOpen: (open: boolean) => setPanel({ mobile, open }),
    confirm,
    closeConfirmation: () => setConfirm(null),
    requestConfirmation,
    requestPreview,
    afterClose,
    triggerRef,
  }
}

type ConfirmationProps = Omit<Props, 'livePath'> & {
  confirmation: Confirmation
  close: () => void
  returnFocus: () => HTMLElement | null
}
function DocumentConfirmation({
  workspace,
  publish,
  remove,
  confirmation,
  close,
  returnFocus,
}: ConfirmationProps): ReactNode {
  const text = useEditorLabels()
  return (
    <ConfirmDialog
      title={text(confirmation === 'unpublish'
        ? 'Unpublish this document?'
        : 'Delete this unpublished document? History and media will be retained.')}
      returnFocus={returnFocus}
      close={close}
      accept={() => {
        close()
        workspace.run(confirmation === 'unpublish' ? publish(true) : remove())
      }}
    />
  )
}

function documentActions(
  workspace: Workspace,
  livePath: string | null,
  text: UiText,
): DocumentAction[] {
  const { busy, draft, run, model } = workspace
  const canSync = !busy && !model.uploading && (draft.status === 'dirty' || draft.status === 'offline')
  return [
    {
      label: text('Sync draft now'),
      icon: RefreshCw,
      disabled: !canSync,
      select: () => {
        if (!canSync || model.composingRef.current) {
          return false
        }
        run(draft.coordinator.flush())
        return true
      },
    },
    {
      label: text('View and compare revisions'),
      icon: History,
      href: `/admin/documents/${draft.ack.documentId}/history`,
    },
    ...(livePath === null
      ? []
      : [
          { label: text('View live document'), icon: ArrowUpRight, href: livePath, external: true },
        ]),
  ]
}
