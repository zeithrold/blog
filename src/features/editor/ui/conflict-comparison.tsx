import type { ReactNode } from 'react'
import type { Workspace } from '@/features/editor/core/editor-types'
import type { OpenDocument } from '@/features/editor/services/api-client'
import type { RevisionDifference } from '@/features/history/revision-diff'
import type { BlogTranslator } from '@/i18n/instance'
import { ChevronDown, GitCompareArrows, LoaderCircle } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button, Collapsible, CollapsibleContent } from '@/components/ui/ztd-me/client'
import { background } from '@/features/editor/core/tasks'
import { compareRevisions } from '@/features/history/revision-diff'
import { RevisionDiffView } from '@/features/history/revision-diff-view'
import { useBlogTranslation } from '@/i18n/use-translation'

const utility1Class = [
  '[&_.conflict-compare-trigger]:p-[6px] [&_.conflict-compare-trigger]:text-muted-foreground',
].join(' ')

const utility2Class = [
  'conflict-comparison-summary editor-field-help m-0 text-muted-foreground text-help',
  'leading-[1.65]',
].join(' ')

const utility3Class = ['editor-field-help m-0 text-muted-foreground text-help leading-[1.65] wrap-anywhere'].join(' ')

const layout1Class = [
  'conflict-comparison mt-2 [&_.conflict-compare-trigger]:gap-[6px]',
  '[&_.conflict-compare-trigger]:min-h-9 [&_.conflict-compare-trigger]:ml-[-6px]',
  utility1Class,
  '[&_.conflict-compare-trigger]:text-[length:13px]',
  'max-[701px]:[&_.conflict-compare-trigger]:min-h-11',
].join(' ')

const layout2Class = [
  'conflict-compare-trigger [&_>_svg]:shrink-0',
  '[&[aria-expanded=true]_.conflict-compare-chevron]:transform-[rotate(180deg)]',
].join(' ')

const layout3Class = [utility2Class, 'wrap-anywhere'].join(' ')

type Comparison = {
  difference: RevisionDifference
  editSeq: number
}

export function ConflictComparison({ workspace, remote }: {
  workspace: Workspace
  remote: OpenDocument
}): ReactNode {
  const text = useBlogTranslation('editor').t
  const state = useComparison(workspace, remote)
  const contentId = useId()
  return (
    <Collapsible
      className={layout1Class}
      open={state.open}
      role="region"
      aria-label={text('conflictComparison')}
    >
      <div className="conflict-comparison-toolbar flex items-center flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className={layout2Class}
          aria-expanded={state.open}
          aria-controls={contentId}
          disabled={workspace.busy || state.loading}
          onClick={() => background(state.compare(), () => {})}
        >
          {state.loading
            ? <LoaderCircle size={15} className="revision-loading-icon" aria-hidden="true" />
            : <GitCompareArrows size={15} aria-hidden="true" />}
          {text('compareLocalAndServer')}
          <ChevronDown
            size={14}
            className="conflict-compare-chevron [transition:transform_160ms_ease]"
            aria-hidden="true"
          />
        </Button>
      </div>
      {state.loading && <p role="status" className={utility3Class}>{text('comparingDrafts')}</p>}
      {state.failed && <p role="alert">{text('couldNotCompareDraftsCheckTheLocalContentAndRetry')}</p>}
      <CollapsibleContent id={contentId} className="conflict-comparison-content grid gap-3 [&_p]:m-0">
        {state.comparison !== null && (
          <ComparisonDetails comparison={state.comparison} remote={remote} text={text} stale={state.stale} />
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

function useComparison(workspace: Workspace, remote: OpenDocument) {
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const { stale, resetStale } = useComparisonStale(comparison, workspace.model.editor)
  const outdated = stale || (comparison !== null && comparison.editSeq !== workspace.draft.coordinator.editSeq)
  const flightRef = useRef(false)
  const compare = async (): Promise<void> => {
    if (workspace.busy || workspace.model.composingRef.current || flightRef.current) {
      return
    }
    if (comparison !== null && !outdated && !failed) {
      setOpen(!open)
      return
    }
    flightRef.current = true
    setLoading(true)
    setFailed(false)
    const editSeq = workspace.draft.coordinator.editSeq
    try {
      const local = await workspace.model.snapshot()
      setComparison({ difference: compareRevisions(remote.document, local), editSeq })
      setOpen(true)
      resetStale()
    }
    catch {
      setFailed(true)
    }
    finally {
      flightRef.current = false
      setLoading(false)
    }
  }
  return { comparison, open, loading, failed, stale: outdated, compare }
}
function useComparisonStale(comparison: Comparison | null, editor: Workspace['model']['editor']): {
  stale: boolean
  resetStale: () => void
} {
  const [stale, setStale] = useState(false)
  useEffect(() => {
    if (comparison !== null) {
      return editor.onChange(() => setStale(true))
    }
  }, [comparison, editor])
  return { stale, resetStale: () => setStale(false) }
}
function ComparisonDetails({ comparison, stale, remote, text }: {
  comparison: Comparison
  stale: boolean
  remote: OpenDocument
  text: BlogTranslator<'editor'>
}): ReactNode {
  return (
    <>
      <p className={layout3Class}>
        {text('theBaselineIsServerVersionValue0TheSelectedContentIsYourLocal', { value0: remote.version })}
      </p>
      {stale && (
        <p role="status" className="conflict-comparison-stale text-[var(--ztd-warning)] text-[length:13px]">
          {text('localContentChangedAfterThisComparisonCompareAgain')}
        </p>
      )}
      <RevisionDiffView
        key={comparison.editSeq}
        difference={comparison.difference}
        labels={{ before: text('serverDraft'), after: text('localDraftSnapshot') }}
      />
    </>
  )
}
