import type { OpenDocument } from '@/contracts/documents'
import type { Draft } from '@/features/editor/draft/persistence'
import type { DocumentModel } from '@/features/editor/workspace/document-model'

export type EditorProps = {
  initial: OpenDocument
  owner: string
  csrfToken: string
  recovered?: boolean
}

export type SessionProps = EditorProps & {
  reopen: (document: OpenDocument, recovered?: boolean) => void
}

/**
 * The workspace fields the Content tab's sections read: the opened document, the
 * modelled envelope and node items, the editor locale and the busy flag. A full
 * `Workspace` satisfies it.
 */
export type ContentSettingsWorkspace = {
  readonly props: Pick<SessionProps, 'initial'>
  readonly model: Pick<DocumentModel, 'envelope' | 'nodeItems' | 'editorLocale'>
  readonly busy: boolean
}

export type Workspace = {
  props: SessionProps
  model: DocumentModel
  draft: Draft
  busy: boolean
  run: (task: Promise<unknown>) => void
  perform: (task: () => Promise<void>, options?: { saveDraft: boolean }) => Promise<void>
}
