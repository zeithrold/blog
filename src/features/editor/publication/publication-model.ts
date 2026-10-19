import type { PublicationIssue } from '@/content/publication-issues'
import type { NodeItem } from '@/features/editor/engine/native'
import type { Envelope } from '@/features/editor/workspace/document-model'
import { publicationNodeRequirements } from '@/content/publication-validation'

export type { PublicationIssue } from '@/content/publication-issues'

export function publicationIssues(envelope: Envelope, nodes: NodeItem[]): PublicationIssue[] {
  return publicationNodeRequirements(envelope, nodes)
}
