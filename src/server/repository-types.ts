import type { Document } from '@/content/document'

export type Row = {
  id: string
  kind: 'article' | 'page'
  head_revision_id: string
  live_revision_id: string | null
  version: number
  live_generation: number
  first_published_at: number | null
}

export type Acknowledgement = {
  documentId: string
  version: number
  headRevisionId: string
  liveRevisionId: string | null
  liveGeneration: number
  unchanged?: boolean
}

export type OpenDocument = Acknowledgement & {
  kind: 'article' | 'page'
  livePath: string | null
  document: Document
}

export type Mutation = {
  key: string
  hash: string
  actor: string
}

export type Bind = string | number | null
