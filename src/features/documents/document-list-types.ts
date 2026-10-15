import type { DocumentListCopy } from '@/features/documents/document-list-copy'
import type { DocumentsController, DocumentsState } from '@/features/documents/document-list-model'

export type ListProps = { controller: DocumentsController, state: DocumentsState, copy: DocumentListCopy }
