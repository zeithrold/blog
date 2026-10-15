import type { Document } from '@/content/envelope'
import type { PublicationIssue } from '@/content/publication-issues'
import type { PublicationNode } from '@/content/publication-nodes'
import { SLUG } from '@/content/base'
import { publicationNode } from '@/content/publication-nodes'
import { allBlocks, MEDIA_TYPES } from '@/content/tree'

export type PublicationProblem = { issue: PublicationIssue, blockIds: string[] }
type Report = (issue: PublicationIssue, blockId?: string) => void

export function publicationRequirements(document: Document): PublicationIssue[] {
  const nodes = Array.from(allBlocks(document.blocks), ({ block }) => publicationNode(block))
  return publicationNodeRequirements(document, nodes)
}

export function publicationNodeRequirements(
  document: Omit<Document, 'blocks'>,
  nodes: PublicationNode[],
): PublicationIssue[] {
  return publicationProblems(document, nodes).map(problem => problem.issue)
}

export function publicationProblems(
  document: Omit<Document, 'blocks'>,
  nodes: PublicationNode[],
): PublicationProblem[] {
  const problems = new Map<PublicationIssue, Set<string>>()
  const report: Report = (issue, blockId) => {
    const ids = problems.get(issue) ?? new Set<string>()
    if (blockId !== undefined) {
      ids.add(blockId)
    }
    problems.set(issue, ids)
  }
  if (document.meta.title.trim() === '') {
    report('title')
  }
  if (!SLUG.safeParse(document.meta.slug).success || [
    'admin',
    'api',
    'assets',
    'search',
    'licenses',
  ].includes(document.meta.slug)) {
    report('slug')
  }
  const references = new Set(document.references.map(reference => reference.id))
  const footnotes = new Set(nodes.filter(node => node.type === 'footnote').map(node => node.id))
  for (const node of nodes) {
    checkBlock(document, node, report)
    if (node.references.some(id => !references.has(id))) {
      report('citation', node.id)
    }
    if (node.footnotes.some(id => !footnotes.has(id))) {
      report('footnote', node.id)
    }
  }
  return Array.from(problems, ([issue, ids]) => ({ issue, blockIds: Array.from(ids) }))
}

function checkBlock(document: Omit<Document, 'blocks'>, block: PublicationNode, report: Report): void {
  if (block.type === 'table' && (document.tableAccessibility[block.id]?.caption.trim() ?? '') === '') {
    report('table', block.id)
  }
  if (block.invalidDiagram) {
    report('diagram', block.id)
  }
  if (MEDIA_TYPES.has(block.type)) {
    checkMedia(document, block, report)
  }
}

function checkMedia(document: Omit<Document, 'blocks'>, block: PublicationNode, report: Report): void {
  if (block.missingMediaSource) {
    report('mediaSource', block.id)
  }
  const media = document.mediaAccessibility[block.id]
  if (media === undefined) {
    report('media', block.id)
    return
  }
  if (block.type === 'image' && !media.decorative && media.alt.trim() === '') {
    report('image', block.id)
  }
  if ((block.type === 'audio' || block.type === 'video') && media.transcript.trim() === '') {
    report('transcript', block.id)
  }
}
