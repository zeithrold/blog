import type { ReactNode } from 'react'
import type { PublicationRejection } from '@/features/editor/draft/draft-errors'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { CircleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/ztd-me/client'
import { EditorNotice } from '@/features/editor/draft/notice-shell'
import { PublicationIssueList } from '@/features/editor/publication/publication-issue-list'
import { useEditorLabels } from '@/i18n/use-labels'
import { useBlogTranslation } from '@/i18n/use-translation'

export function DraftErrorNotice({ error, conflictShown }: {
  error: string
  conflictShown: boolean
}): ReactNode {
  const text = useBlogTranslation('editor').t
  const labels = useEditorLabels()
  if (error === '' || (error === 'EDIT_CONFLICT' && conflictShown)) {
    return null
  }
  if (error === 'RESTORE_RELOAD_REQUIRED') {
    return (
      <EditorNotice title={labels('Draft restored')} icon={<CircleAlert size={18} />} tone="error">
        <p className="editor-notice-description m-0 text-muted-foreground wrap-anywhere" role="alert">
          {labels('The revision was restored, but the editor could not reload it. Reload the page before editing.')}
        </p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => window.location.reload()}>
          {labels('Reload page')}
        </Button>
      </EditorNotice>
    )
  }
  const conflict = error === 'EDIT_CONFLICT'
  const validationMessages: Record<string, string> = {
    INVALID_DOCUMENT: text('documentValidationFailed'),
    DOCUMENT_TOO_LARGE: text('documentTooLarge'),
  }
  const description = validationMessages[error] ?? labels(error)
  return (
    <EditorNotice
      title={text(conflict ? 'draftChangedElsewhere' : 'editorOperationFailed')}
      icon={<CircleAlert size={18} />}
      tone={conflict ? 'conflict' : 'error'}
    >
      <p className="editor-notice-description m-0 text-muted-foreground wrap-anywhere" role="alert">
        {conflict ? text('draftChangedElsewhereDescription') : description}
      </p>
    </EditorNotice>
  )
}

export function PublicationErrorNotice({ rejection, workspace }: {
  rejection: PublicationRejection
  workspace: Workspace
}): ReactNode {
  const text = useBlogTranslation('editor').t
  const noticeRef = useRef<HTMLElement>(null)
  const { attempt, issues } = rejection
  useEffect(() => {
    const notice = noticeRef.current
    if (notice === null) {
      return
    }
    notice.focus({ preventScroll: true })
    const headerBottom = document.querySelector('.workspace-header')?.getBoundingClientRect().bottom ?? 0
    const bounds = notice.getBoundingClientRect()
    if (bounds.top < headerBottom || bounds.bottom > window.innerHeight) {
      window.scrollBy({ top: bounds.top - headerBottom - 16, behavior: 'instant' })
    }
  }, [attempt])
  return (
    <EditorNotice
      ref={noticeRef}
      tabIndex={-1}
      title={text('publicationRejected')}
      icon={<CircleAlert size={18} />}
      tone="error"
    >
      <div className="editor-notice-description text-muted-foreground wrap-anywhere" role="alert">
        <p className="m-0">
          {text(issues.length > 0 ? 'publicationRejectedDescription' : 'documentValidationFailed')}
        </p>
        {issues.length > 0 && (
          <ul className="mb-0 mt-2 list-disc space-y-1 pl-5">
            <PublicationIssueList issues={issues} workspace={workspace} />
          </ul>
        )}
      </div>
    </EditorNotice>
  )
}
