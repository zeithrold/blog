/* eslint-disable react-refresh/only-export-components -- Test support, not a Fast Refresh boundary. */
import type { ReactNode } from 'react'
import type { Stub } from './publication-stub'
import type { MountedPublication, PublicationMount, PublicationProbe } from './publication-types'
import type { FrontendPreferences, Locale } from '@/components/ui/ztd-me'
import type { OpenDocument } from '@/contracts/documents'
import type { Draft } from '@/features/editor/draft/persistence'
import type { ScheduleModel } from '@/features/editor/publication/schedule-controller'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { act, useCallback, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { DraftNotices } from '@/features/editor/draft/notices'
import { useDraft } from '@/features/editor/draft/persistence'
import { useSchedule, useScheduleList } from '@/features/editor/publication/schedule-controller'
import { ScheduleSettings } from '@/features/editor/publication/schedule-settings'
import { ScheduledStatus } from '@/features/editor/publication/schedule-status'
import { useActions } from '@/features/editor/workspace/actions'
import { BlogFrontend } from '@/i18n/frontend'
import { SaveStatus } from '@/shared/admin/save-status'
import {
  advance,
  button,
  cancelControls,
  click,
  combobox,
  drainHostTask,
  installBrowserShims,
  openCombobox,
  option,
  scheduledBadge,
  text,
  texts,
  typeText,
  until,
} from './publication-dom'
import { useEditorBoundary } from './publication-editor-boundary'
import { PublicationHeader } from './publication-header'
import { publicationHandlers, serveFetch } from './publication-stub'

export type { MountedPublication, PublicationMount, PublicationProbe } from './publication-types'

export {
  advance,
  button,
  cancelControls,
  click,
  combobox,
  drainHostTask,
  openCombobox,
  option,
  scheduledBadge,
  text,
  texts,
  typeText,
  until,
}

/*
 * The publication/schedule half of the DOM pilot: the real draft coordinator,
 * controllers, client, i18n and notice components, with only HTTP declared.
 *
 * The BlockNote editor is the one product surface this layer excludes, exactly
 * as the history pilot excludes the router and Worker. `useEditorBoundary`
 * supplies the document data and change hook the real controllers read; it
 * contains no publication, draft or schedule rule.
 */

const owner = 'dom-pilot-owner'
const csrfToken = 'dom-pilot-csrf'
const preferencePolicy = createPreferencePolicy({
  name: 'blog.dom.pilot.v1',
  secure: false,
})

function usePublicationProbe(
  initial: OpenDocument,
  onProbe: (probe: PublicationProbe) => void,
): {
  workspace: Workspace
  schedule: ScheduleModel
  setResolving: (busy: boolean) => void
  actions: ReturnType<typeof useActions>
} {
  const boundary = useEditorBoundary(initial)
  const model = boundary.model
  const [reopens, setReopens] = useState(0)
  const props = useMemo(() => ({
    initial,
    owner,
    csrfToken,
    reopen: () => {
      setReopens(count => count + 1)
    },
  }), [initial])
  const draft: Draft = useDraft({
    initial,
    owner,
    csrfToken,
    model,
    recovered: false,
  })
  const actions = useActions({ props, model, draft })
  const [resolving, setResolving] = useState(false)
  const { run, settle } = useTrackedRun(actions)
  const workspace: Workspace = {
    props,
    model,
    draft,
    busy: actions.busy || resolving,
    run,
    perform: actions.perform,
  }
  const list = useScheduleList(workspace)
  const schedule = useSchedule(workspace, list)
  onProbe({
    workspace,
    actions,
    schedule,
    list,
    settle,
    emitContentChange: boundary.emitContentChange,
    reopenCount: () => reopens,
  })
  return { workspace, schedule, setResolving, actions }
}

function useTrackedRun(actions: ReturnType<typeof useActions>): {
  run: (task: Promise<unknown>) => void
  settle: () => Promise<void>
} {
  const inflightRef = useRef(new Set<Promise<void>>())
  const runAction = actions.run
  const run = useCallback((task: Promise<unknown>) => {
    runAction(task)
    const settled = task.then(() => undefined, () => undefined)
    inflightRef.current.add(settled)
    settled
      .then(() => {
        inflightRef.current.delete(settled)
      })
      .catch(() => {})
  }, [runAction])
  const settle = useCallback(async () => {
    while (inflightRef.current.size > 0) {
      await Promise.all(inflightRef.current)
    }
  }, [])
  return { run, settle }
}

function PublicationSurface({
  initial,
  header,
  onProbe,
}: {
  initial: OpenDocument
  header?: { livePath: () => string | null }
  onProbe: (probe: PublicationProbe) => void
}): ReactNode {
  const { workspace, schedule, setResolving, actions } = usePublicationProbe(initial, onProbe)
  return (
    <>
      {header !== undefined && (
        <PublicationHeader
          workspace={workspace}
          actions={actions}
          schedule={schedule}
          livePath={header.livePath}
        />
      )}
      <DraftNotices workspace={workspace} setResolving={setResolving} />
      <SaveStatus status={workspace.draft.status} className="save-status" />
      <ScheduledStatus items={schedule.items} />
      <ScheduleSettings
        workspace={workspace}
        model={schedule}
        open
        setOpen={() => {}}
      />
    </>
  )
}

function preferences(locale: Locale): FrontendPreferences {
  return { version: 1, mode: 'light', palette: 'neutral', locale }
}

const views: MountedPublication[] = []
const activeStubs: Stub[] = []

type Surface = {
  container: HTMLElement
  root: ReturnType<typeof createRoot>
  state: () => PublicationProbe
}

function renderSurface(
  initial: OpenDocument,
  locale: Locale,
  header?: { livePath: () => string | null },
): Surface {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  let latest: PublicationProbe | null = null
  act(() => {
    root.render(
      <BlogFrontend initialPreferences={preferences(locale)} policy={preferencePolicy}>
        <PublicationSurface
          initial={initial}
          header={header}
          onProbe={(probe) => {
            latest = probe
          }}
        />
      </BlogFrontend>,
    )
  })
  return {
    container,
    root,
    state: () => {
      if (latest === null) {
        throw new Error('The publication surface never rendered')
      }
      return latest
    },
  }
}

/** Mounts the real draft/schedule controllers and notice components in jsdom. */
export function mountPublication(input: PublicationMount): MountedPublication {
  installBrowserShims()
  const stub = serveFetch(publicationHandlers(input.server, input.writes ?? {}))
  activeStubs.push(stub)
  const { container, root, state } = renderSurface(
    input.server.open,
    input.locale ?? 'en',
    input.header,
  )
  let unmounted = false
  const mounted: MountedPublication = {
    server: input.server,
    stub,
    container,
    state,
    load: async () => {
      await act(async () => {
        await state().schedule.load()
      })
    },
    settle: async () => {
      await act(async () => {
        await state().settle()
      })
    },
    editTitle: (title) => {
      act(() => {
        // The production title path: EditorSession.update calls both.
        const { model, draft } = state().workspace
        model.updateFields({ meta: { ...model.envelope.meta, title } })
        draft.changed()
      })
    },
    emitContentChange: () => {
      act(() => {
        state().emitContentChange()
      })
    },
    reopenCount: () => state().reopenCount(),
    unmount: () => {
      if (unmounted) {
        return
      }
      unmounted = true
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
  views.push(mounted)
  return mounted
}

/** Unmounts, restores `fetch` and fails on any request the case did not serve. */
export function resetDomPilot(): void {
  try {
    for (const view of views.splice(0)) {
      view.unmount()
    }
  }
  finally {
    const stubs = activeStubs.splice(0)
    // A later mount wraps the previous stub, so restore in the reverse order.
    for (const stub of stubs.slice().reverse()) {
      stub.restore()
    }
    for (const stub of stubs) {
      expect(stub.unhandled).toEqual([])
    }
  }
}
