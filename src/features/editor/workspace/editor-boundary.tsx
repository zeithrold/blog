'use client'
import type { ReactNode } from 'react'
import type { DepartureState } from '@/features/editor/workspace/editor-departure'
import type { EditorDepartureBoundary } from '@/features/editor/workspace/editor-departure-context'
import { LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ztd-me/client'
import { EditorDeparture } from '@/features/editor/workspace/editor-departure'
import { EditorDepartureContext } from '@/features/editor/workspace/editor-departure-context'
import { EditorDepartureSource } from '@/features/editor/workspace/editor-departure-source'
import { useEditorLabels } from '@/i18n/use-labels'
import { useBlogTranslation } from '@/i18n/use-translation'
import { useInternalNavigationGuard } from '@/shared/admin/navigation-guard-context'

/**
 * Marks the editor route as a full-document navigation boundary.
 *
 * The boundary belongs to the route, not to the loaded workspace, so it guards
 * departures while the entry is still loading or has failed to load: leaving the
 * editor is a document navigation from the first render, never a client-side
 * route change. Once the workspace attaches, the same guard waits for uploads and
 * the final save, and reports a failure in this dialog instead of leaving.
 *
 * Browser Back/Forward, refresh and close are not intercepted here: the editor's
 * own unload guards decide those, and the one departure this dialog approved is
 * exempted from their second, native confirmation.
 */
export function EditorBoundary({ children }: { children: ReactNode }): ReactNode {
  const [departure] = useState<EditorDepartureBoundary>(() => {
    const source = new EditorDepartureSource(href => window.location.assign(href))
    const permit = { approved: false, event: null }
    return { source, controller: new EditorDeparture(source, permit), permit }
  })
  const { source, controller } = departure
  const request = useCallback((href: string) => {
    if (source.blocked()) {
      controller.request(href)
    }
    else {
      source.navigate(href)
    }
  }, [source, controller])
  useInternalNavigationGuard(true, request)
  useEffect(() => controller.dispose, [controller])
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  return (
    <EditorDepartureContext value={departure}>
      {children}
      {state.phase === 'idle' ? null : <DepartureDialog controller={controller} state={state} />}
    </EditorDepartureContext>
  )
}

function DepartureDialog({ controller, state }: {
  controller: EditorDeparture
  state: DepartureState
}): ReactNode {
  const text = useEditorLabels()
  const priorRef = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement)
  return (
    <Dialog open onOpenChange={open => !open && controller.cancel()}>
      <DialogContent
        className="w-[min(480px,calc(100vw-32px))]"
        aria-busy={state.phase === 'saving'}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          restoreDepartureFocus(priorRef.current)
        }}
      >
        <DialogHeader>
          <DialogTitle>{text(state.phase === 'saving' ? 'Saving before leaving' : 'Save before leaving')}</DialogTitle>
          <DialogDescription>
            {text(state.phase === 'saving'
              ? 'Finishing uploads and saving your latest changes. You can stay here while this completes.'
              : 'Your changes could not be saved. Stay here to review the error, or retry.')}
          </DialogDescription>
        </DialogHeader>
        <DepartureStatus state={state} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={controller.cancel}>{text('Stay here')}</Button>
          {state.phase === 'error' && (
            <>
              <Button type="button" variant="ghost" className="text-destructive" onClick={controller.leave}>
                {text('Leave without saving')}
              </Button>
              <Button type="button" onClick={controller.retry}>{text('Retry save')}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function restoreDepartureFocus(prior: Element | null): void {
  if (prior instanceof HTMLElement && prior.isConnected && prior !== document.body
    && prior.getClientRects().length > 0 && prior.closest('[role="menu"]') === null
    && prior.getAttribute('aria-expanded') !== 'true') {
    prior.focus({ preventScroll: true })
    return
  }
  const mobile = document.querySelector<HTMLElement>('.workspace-navigation-mobile')
  if (mobile !== null && mobile.getClientRects().length > 0 && mobile.getAttribute('aria-expanded') !== 'true') {
    mobile.focus({ preventScroll: true })
  }
}

function DepartureStatus({ state }: { state: DepartureState }): ReactNode {
  const text = useEditorLabels()
  const messages = useBlogTranslation('editor').t
  const validation: Record<string, string> = {
    INVALID_DOCUMENT: messages('documentValidationFailed'),
    DOCUMENT_TOO_LARGE: messages('documentTooLarge'),
  }
  return state.phase === 'saving'
    ? <LoaderCircle className="animate-spin motion-reduce:animate-none text-muted-foreground" aria-hidden="true" />
    : (
        <div className="grid gap-2 text-help wrap-anywhere" role="alert">
          <p className="m-0 text-destructive">{validation[state.error] ?? text(state.error)}</p>
          <p className="m-0 text-muted-foreground">
            {text(state.recovered
              ? 'A local draft copy has been saved. Queued files are not included in this copy.'
              : 'Local recovery is unavailable. Leaving now may lose your changes.')}
          </p>
        </div>
      )
}
