import type { ReactNode } from 'react'
import type { Workspace } from '@/features/editor/core/editor-types'
import type { DepartureState } from '@/features/editor/services/editor-departure'
import type { DepartureQueue } from '@/features/editor/services/editor-departure-source'
import { LoaderCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ztd-me/client'
import { EditorDeparture } from '@/features/editor/services/editor-departure'
import {
  EditorDepartureSource,
} from '@/features/editor/services/editor-departure-source'
import { useEditorLabels } from '@/i18n/use-labels'
import { useBlogTranslation } from '@/i18n/use-translation'
import { useHistoryNavigationGuard, useInternalNavigationGuard } from '@/shared/admin/navigation-guard-context'

export function EditorNavigation({ workspace, queue }: { workspace: Workspace, queue: DepartureQueue }): ReactNode {
  const router = useRouter()
  const [source] = useState(() => new EditorDepartureSource(workspace, queue, href => router.push(href)))
  const [controller] = useState(() => new EditorDeparture(source))
  useLayoutEffect(() => {
    source.update(workspace, queue)
  }, [
    source,
    workspace,
    queue,
  ])
  useEffect(() => controller.dispose, [controller])
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  const resolve = useCallback(() => source.blocked() ? controller.request : null, [source, controller])
  const request = useCallback((href: string) => {
    if (source.blocked()) {
      controller.request(href)
    }
    else {
      source.navigate(href)
    }
  }, [source, controller])
  useInternalNavigationGuard(true, request)
  const cancelHistory = useHistoryNavigationGuard(resolve, controller.cancel)
  const cancel = useCallback(() => {
    cancelHistory()
    controller.cancel()
  }, [cancelHistory, controller])
  return state.phase === 'idle' ? null : <NavigationDialog controller={controller} state={state} cancel={cancel} />
}

function NavigationDialog({ controller, state, cancel }: {
  controller: EditorDeparture
  state: DepartureState
  cancel: () => void
}): ReactNode {
  const text = useEditorLabels()
  const priorRef = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement)
  return (
    <Dialog open onOpenChange={open => !open && cancel()}>
      <DialogContent
        className="editor-navigation-dialog w-[min(480px,calc(100vw-32px))]"
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
          <Button type="button" variant="outline" onClick={cancel}>{text('Stay here')}</Button>
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
