/* eslint-disable react-refresh/only-export-components -- Test support, not a Fast Refresh boundary. */
import type { ReactNode, RefObject } from 'react'
import type { Acknowledgement } from '@/contracts/documents'
import type { DepartureQueue, DepartureWorkspace } from '@/features/editor/workspace/editor-departure-source'
import type { Guard } from '@/shared/admin/navigation-guard-context'
import type { HostRouter } from '~/tests/components/src/adapters/next-navigation'
import { useRouter } from 'next/navigation'
import { act, useEffect } from 'react'
import { vi } from 'vitest'
import { emptyDocument } from '@/content/document'
import { DraftCoordinator } from '@/features/editor/draft/draft'
import { EditorNavigation } from '@/features/editor/workspace/editor-navigation'
import { MediaUploadQueue } from '@/features/media/upload-queue'
import { NavigationGuardContext } from '@/shared/admin/navigation-guard-context'
import { renderElement, resetDomPage } from './history-state-support'

/**
 * The editor's departure policy in jsdom: the real `EditorNavigation` over the
 * real `EditorDepartureSource` and `EditorDeparture`, a real `DraftCoordinator`
 * and a real upload boundary, mounted inside the product's own frontend
 * providers so the dialog renders the editor's own copy.
 *
 * A case drives the event the shell produces — the guard this component
 * registers, called with the reader's target — and observes two external
 * boundaries: the host router's own `push`, spied for the case's lifetime and
 * left to call through, and the save/upload ports the product already exposes.
 * The case also owns the clock: the policy polls on a 40ms timer and the
 * coordinator autosaves on a 2000ms one, so scoped fake timers make both
 * deterministic and `resetDeparture` restores real timers and real mocks.
 *
 * `next/navigation` is the official DOM adapter, so the spy sees the call the
 * editor really makes; jsdom still delivers no document navigation, and route
 * delivery, native back, `onNavigate` interception and focus hand-back stay
 * browser facts.
 */

/** The editor's own words for a departure that saves first. */
export const savingCopy = 'Saving before leaving'

/** The editor's own control for refusing that departure. */
export const stayCopy = 'Stay here'

export type DepartureHarness = {
  /** The in-app navigation the shell performs: the guard registration, called. */
  leave: (href: string) => Promise<void>
  /** One edit, the way the editor records unsaved work. */
  edit: () => void
  /** The mounted saving dialog, while the departure is asking. */
  dialog: () => HTMLElement | null
  /** The dialog's whole copy, with whitespace collapsed as a reader sees it. */
  phrase: () => string
  /** The dialog's own busy state: the value a save in flight publishes. */
  busy: () => string | null
  /** A real click on one of the dialog's own controls, by accessible name. */
  press: (name: string) => Promise<void>
  /** Save packets the coordinator sent. */
  saves: () => number
  /** Local-recovery writes; only a failed departure reaches them. */
  recoveries: () => number
  /** Whether the editor still holds work it has not saved. */
  dirty: () => boolean
  /** The server's answer to the held save, whenever it arrives. */
  acknowledge: () => Promise<void>
  /** A document upload in flight, the way `MediaInputs.uploadFiles` holds one. */
  upload: () => void
  /** The completed upload, then the policy's own 40ms wait crossed. */
  finishUpload: () => Promise<void>
  /** The target of every departure the editor handed to the host router. */
  departures: () => readonly string[]
  /** Timers this case's clock still holds: the policy's wait is one of them. */
  pendingTimers: () => number
}

// Each surface owns what it opened, so a case never inherits a coordinator from
// the one before it.
const owned: Array<() => void> = []

type DraftBoundary = {
  readonly coordinator: DraftCoordinator
  /** Save packets sent so far. */
  readonly saves: () => number
  /** The server's answer to the packet a save is holding. */
  readonly acknowledge: () => void
}

/**
 * The save boundary the dialog waits on: a real `DraftCoordinator` whose packet
 * stays open until the case answers it, as the server eventually would.
 */
function draftBoundary(acknowledgement: Acknowledgement): DraftBoundary {
  let saves = 0
  let answer: (() => void) | null = null
  const coordinator = new DraftCoordinator(
    acknowledgement,
    async () => await Promise.resolve(emptyDocument()),
    async () => {
      saves += 1
      return await new Promise<Acknowledgement>((resolve) => {
        answer = () => {
          resolve({
            ...acknowledgement,
            version: acknowledgement.version + 1,
            headRevisionId: crypto.randomUUID(),
          })
        }
      })
    },
    () => {},
  )
  return {
    coordinator,
    saves: () => saves,
    acknowledge: () => {
      answer?.()
      answer = null
    },
  }
}

type UploadBoundary = {
  readonly model: DepartureWorkspace['model']
  /** Starts an upload that stays in flight until `finish`. */
  readonly hold: () => void
  readonly finish: () => void
}

/**
 * A document upload in flight, spelled the way `MediaInputs` holds one:
 * `hasUploads` is a pending insert and `waitUploads` awaits that same promise,
 * which the completed request clears.
 */
function uploadBoundary(): UploadBoundary {
  let pending: Promise<string> | null = null
  let complete: (() => void) | null = null
  return {
    model: {
      composingRef: { current: false },
      hasUploads: () => pending !== null,
      waitUploads: async () => {
        if (pending !== null) {
          await pending
        }
      },
    },
    hold: () => {
      const held = new Promise<string>((resolve) => {
        complete = () => {
          resolve(crypto.randomUUID())
        }
      })
      pending = held
      held.finally(() => {
        pending = null
      }).catch(() => {})
    },
    finish: () => {
      complete?.()
      complete = null
    },
  }
}

/** Hands the case the same host router the mounted editor navigates with. */
function RouterProbe({ onto }: { onto: (router: HostRouter) => void }): ReactNode {
  const router = useRouter()
  useEffect(() => {
    onto(router)
  }, [onto, router])
  return null
}

type Mounted = {
  /** The registration `EditorNavigation` installs for in-app navigation. */
  readonly guard: RefObject<Guard | null>
  readonly router: HostRouter
}

function mountDeparture(workspace: DepartureWorkspace, queue: DepartureQueue): Mounted {
  const guard: RefObject<Guard | null> = { current: null }
  const reached: { router: HostRouter | null } = { router: null }
  renderElement(
    <NavigationGuardContext value={guard}>
      <RouterProbe onto={(value) => {
        reached.router = value
      }}
      />
      <EditorNavigation workspace={workspace} queue={queue} />
    </NavigationGuardContext>,
  )
  const router = reached.router
  if (router === null) {
    throw new Error('The host router was not reachable from the mounted tree')
  }
  return { guard, router }
}

/** Dispatches the event the shell's in-app navigation produces. */
async function leave(guard: RefObject<Guard | null>, href: string): Promise<void> {
  const request = guard.current
  if (request === null) {
    throw new Error('The editor registered no navigation guard')
  }
  act(() => {
    request(href)
  })
  await flush()
}

/** Lets React commit and the pending promise chain run on the case's clock. */
async function flush(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

/** The mounted departure dialog, while the policy is asking. */
function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="dialog-content"]')
}

/**
 * One of the dialog's controls, by accessible name.
 *
 * The dialog renders into `document.body` through Radix's portal, so the lookup
 * is document-wide; a missing control lists what the dialog did render.
 */
function control(name: string): HTMLButtonElement {
  const buttons = Array.from(document.querySelectorAll('button'))
  const found = buttons.find(button => (button.getAttribute('aria-label') ?? button.textContent).trim() === name)
  if (found === undefined) {
    const listed = Array.from(buttons, button => JSON.stringify(button.textContent.trim())).join(', ')
    throw new TypeError(`No control named ${name}. Rendered: ${listed}`)
  }
  return found
}

/** The draft the editor is already editing: version 3, saved head, no live one. */
function initialAcknowledgement(): Acknowledgement {
  return {
    documentId: crypto.randomUUID(),
    version: 3,
    headRevisionId: crypto.randomUUID(),
    liveRevisionId: null,
    liveGeneration: 0,
  }
}

export function departureCase(): DepartureHarness {
  // The case owns the clock for its own lifetime: the policy polls at 40ms and
  // the coordinator autosaves at 2000ms, so neither may depend on wall time.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const draft = draftBoundary(initialAcknowledgement())
  const uploads = uploadBoundary()
  // The editor's own media queue, empty: nothing is queued and no batch runs, so
  // the queue's own inputs are the real idle ones a case reads.
  const queue = new MediaUploadQueue<string>(
    async () => await Promise.resolve(crypto.randomUUID()),
    () => {},
  )
  let recoveries = 0
  const workspace: DepartureWorkspace = {
    busy: false,
    model: uploads.model,
    draft: {
      coordinator: draft.coordinator,
      // jsdom has no IndexedDB and no case fails a departure, so this records a
      // fallback that never happens instead of standing in for the recovery.
      persistLocal: async () => {
        recoveries += 1
        return await Promise.resolve(false)
      },
    },
  }
  const { guard, router } = mountDeparture(workspace, queue)
  // The router is the adapter's own object, and the spy calls through: the
  // editor still executes the same push it would in the browser layer.
  const push = vi.spyOn(router, 'push')
  owned.push(() => draft.coordinator.dispose())
  return {
    leave: async href => await leave(guard, href),
    edit: () => draft.coordinator.change(),
    dialog,
    phrase: () => (dialog()?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    busy: () => dialog()?.getAttribute('aria-busy') ?? null,
    press: async (name) => {
      const button = control(name)
      act(() => {
        button.click()
      })
      await flush()
    },
    saves: draft.saves,
    recoveries: () => recoveries,
    dirty: () => draft.coordinator.dirty,
    acknowledge: async () => {
      draft.acknowledge()
      await flush()
    },
    upload: uploads.hold,
    finishUpload: async () => {
      uploads.finish()
      await flush()
      // The source's own wait polls at 40ms; the case crosses that interval
      // instead of assuming the continuation already resumed.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(40)
      })
      await flush()
    },
    departures: () => push.mock.calls.map(([href]) => href),
    pendingTimers: () => vi.getTimerCount(),
  }
}

/** Disposes every departure surface, then the layer's own mount teardown. */
export function resetDeparture(): void {
  try {
    for (const dispose of owned.splice(0)) {
      dispose()
    }
    resetDomPage()
  }
  finally {
    vi.restoreAllMocks()
    vi.useRealTimers()
  }
}
