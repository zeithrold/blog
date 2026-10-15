'use client'
import type { ReactNode } from 'react'
import type { EditorProps } from '@/features/editor/core/editor-types'
import { CircleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/ztd-me/client'
import { APIError } from '@/features/editor/services/api-client'
import { loadEditorEntry } from '@/features/editor/services/editor-entry'
import Editor from '@/features/editor/ui/editor'
import { LoadingEditor } from '@/features/editor/ui/editor-loading'
import { EditorNotice } from '@/features/editor/ui/notice-shell'
import { useEditorLabels } from '@/i18n/use-labels'
import { apiErrorMessages } from '@/shared/admin/errors'
import { GuardedLink } from '@/shared/admin/navigation-guard'

export default function EditorEntry(props: EditorProps): ReactNode {
  return <VerifiedEditor key={`${props.owner}:${props.initial.documentId}`} {...props} />
}

function VerifiedEditor(props: EditorProps): ReactNode {
  const [entry, setEntry] = useState<EditorProps | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const { documentId } = props.initial
  const { owner } = props
  useEffect(() => {
    const controller = new AbortController()
    void loadEditorEntry(documentId, owner, controller.signal).then((loaded) => {
      if (!controller.signal.aborted) {
        setEntry(loaded)
      }
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) {
        setError(failure instanceof APIError ? failure.code : 'CONNECTION_FAILED')
      }
    })
    return () => controller.abort()
  }, [
    documentId,
    owner,
    attempt,
  ])
  if (entry !== null) {
    return <Editor {...entry} recovered={props.recovered} />
  }
  if (error === '') {
    return <LoadingEditor />
  }
  return (
    <EntryError
      error={error}
      retry={() => {
        setError('')
        setAttempt(value => value + 1)
      }}
    />
  )
}

function EntryError({ error, retry }: { error: string, retry: () => void }): ReactNode {
  const text = useEditorLabels()
  const descriptions: Record<string, string> = {
    DOCUMENT_NOT_FOUND: 'This document is unavailable or has been removed.',
    CONNECTION_FAILED: 'Unable to load data. Please retry.',
  }
  const description = descriptions[error] ?? apiErrorMessages[error] ?? 'Unable to load data. Please retry.'
  return (
    <div className="editor-entry-error w-full max-w-205 p-6 max-[639.99px]:p-4">
      <EditorNotice title={text('Unable to open this document.')} tone="error" icon={<CircleAlert size={18} />}>
        <p className="m-0 text-muted-foreground" role="alert">
          {text(description)}
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button type="button" onClick={retry}>{text('Retry')}</Button>
          <Button variant="outline" asChild>
            <GuardedLink href="/admin/documents">{text('All documents')}</GuardedLink>
          </Button>
        </div>
      </EditorNotice>
    </div>
  )
}
