import type { PublicationIssue } from '@/content/publication-issues'
import type { DocumentModel } from '@/features/editor/workspace/document-model'
import { useCallback, useState } from 'react'
import { publicationIssues } from '@/features/editor/publication/publication-model'

export type PublicationRejection = { issues: PublicationIssue[], attempt: number }

export function useDraftErrors(model: DocumentModel): {
  error: string
  rejection: PublicationRejection | null
  setError: (code: string, issues?: PublicationIssue[]) => void
  statusError: (code?: string) => void
} {
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState<(PublicationRejection & {
    fields: DocumentModel['envelope']
    nodes: DocumentModel['nodeItems']
  }) | null>(null)
  if (failure !== null && failure.issues.length > 0
    && (failure.fields !== model.envelope || failure.nodes !== model.nodeItems)) {
    const remaining = publicationIssues(model.envelope, model.nodeItems)
    setFailure(remaining.length === 0
      ? null
      : {
          ...failure,
          issues: remaining,
          fields: model.envelope,
          nodes: model.nodeItems,
        })
  }
  const setError = useCallback((code: string, issues: PublicationIssue[] = []) => {
    setMessage(code === 'PUBLICATION_INVALID' ? '' : code)
    if (code === 'PUBLICATION_INVALID') {
      setFailure(previous => ({
        issues,
        attempt: (previous?.attempt ?? 0) + 1,
        fields: model.envelope,
        nodes: model.nodeItems,
      }))
    }
    else if (code === '') {
      setFailure(null)
    }
  }, [model.envelope, model.nodeItems])
  const statusError = useCallback((code?: string) => {
    if (code !== undefined) {
      setError(code)
    }
    else {
      // Saving an unrelated edit does not resolve a rejected publication.
      setMessage('')
    }
  }, [setError])
  return {
    error: message,
    rejection: failure,
    setError,
    statusError,
  }
}
