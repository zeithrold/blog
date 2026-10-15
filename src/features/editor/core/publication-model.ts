import type { PublicationIssue } from '@/content/publication-issues'
import type { Envelope } from '@/features/editor/core/model'
import type { NodeItem } from '@/features/editor/core/native'
import { publicationNodeRequirements } from '@/content/publication-validation'

export type { PublicationIssue } from '@/content/publication-issues'

export function publicationPath(kind: 'article' | 'page', slug: string): string {
  return `/${kind === 'article' ? 'posts' : 'pages'}/${slug}`
}

export function publicationIssues(envelope: Envelope, nodes: NodeItem[]): PublicationIssue[] {
  return publicationNodeRequirements(envelope, nodes)
}
