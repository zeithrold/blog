import type { DocumentModel } from '@/features/editor/core/model'
import type { Draft } from '@/features/editor/core/persistence'
import type { OpenDocument } from '@/features/editor/services/api-client'

export type EditorProps = {
  initial: OpenDocument
  owner: string
  csrfToken: string
  recovered?: boolean
}

export type SessionProps = EditorProps & {
  reopen: (document: OpenDocument, recovered?: boolean) => void
}

export type Workspace = {
  props: SessionProps
  model: DocumentModel
  draft: Draft
  busy: boolean
  run: (task: Promise<unknown>) => void
  perform: (task: () => Promise<void>, options?: { saveDraft: boolean }) => Promise<void>
}
