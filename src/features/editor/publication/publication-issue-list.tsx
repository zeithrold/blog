import type { ReactNode } from 'react'
import type { PublicationIssue } from '@/content/publication-issues'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { Button } from '@/components/ui/ztd-me/client'
import { publicationNode } from '@/content/publication-nodes'
import { publicationProblems } from '@/content/publication-validation'
import { useBlogTranslation } from '@/i18n/use-translation'
import { issueLabels } from '@/shared/admin/publication-issue-labels'

export type RevealPublicationProblem = (reveal: () => void) => void
const revealImmediately: RevealPublicationProblem = run => run()

export function PublicationIssueList({ workspace, issues, reveal = revealImmediately }: {
  workspace: Workspace
  issues: PublicationIssue[]
  reveal?: RevealPublicationProblem
}): ReactNode {
  const text = useBlogTranslation('editor').t
  const problems = publicationProblems(workspace.model.envelope, workspace.model.nodeItems)
  return issues.map(issue => (
    <li key={issue} className="publication-issue">
      <span data-publication-description="">{text(issueLabels[issue])}</span>
      <LocateProblem
        workspace={workspace}
        issue={issue}
        count={problems.find(problem => problem.issue === issue)?.blockIds.length ?? 0}
        reveal={reveal}
      />
    </li>
  ))
}

function LocateProblem({ workspace, issue, count, reveal }: {
  workspace: Workspace
  issue: PublicationIssue
  count: number
  reveal: RevealPublicationProblem
}): ReactNode {
  const text = useBlogTranslation('editor').t
  if (count === 0) {
    return null
  }
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="ml-1 inline h-auto min-h-0 min-w-0 max-w-full rounded-sm border-0 p-0 align-baseline
        text-help font-normal whitespace-normal text-foreground underline decoration-current/40 underline-offset-4
        hover:decoration-current pointer-coarse:min-h-0"
      aria-label={text('locatePublicationProblem', { issue: text(issueLabels[issue]), count })}
      disabled={workspace.busy || workspace.model.uploading}
      onClick={() => reveal(() => locateProblem(workspace, issue))}
    >
      {text(count === 1 ? 'viewPublicationProblem' : 'viewPublicationProblems', { count })}
    </Button>
  )
}

function locateProblem(workspace: Workspace, issue: PublicationIssue): void {
  const { model } = workspace
  if (workspace.busy || model.uploading || model.composingRef.current) {
    return
  }
  // The incremental index retains insertion order after moves. Read current
  // document order only when locating, including after a mobile drawer closes.
  const nodes = new Array<ReturnType<typeof publicationNode>>()
  model.editor.forEachBlock((block) => {
    nodes.push(publicationNode(block))
    return true
  })
  const ids = publicationProblems(model.envelope, nodes).find(problem => problem.issue === issue)?.blockIds ?? []
  const current = model.editor.getTextCursorPosition().block.id
  const id = ids[(ids.indexOf(current) + 1) % ids.length]
  if (id === undefined) {
    return
  }
  model.editor.setTextCursorPosition(id, 'start')
  model.editor.focus()
  revealBlock(model.editor.domElement, id, issue)
}

function revealBlock(root: HTMLElement | undefined, id: string, issue: PublicationIssue): void {
  const block = root?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)
  const selectors: Partial<Record<PublicationIssue, string>> = {
    table: '.editor-table-caption button',
    diagram: '[data-publication-editor]',
  }
  const selector = selectors[issue]
  const control = selector === undefined ? null : block?.querySelector<HTMLElement>(selector)
  control?.focus({ preventScroll: true })
  const target = control ?? block?.querySelector('.bn-block-content') ?? block
  target?.scrollIntoView({ block: 'center', behavior: 'instant' })
}
