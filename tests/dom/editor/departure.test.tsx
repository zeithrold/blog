import type { ReactNode, RefObject } from 'react'
import type { DeparturePermit } from '@/features/editor/workspace/editor-departure'
import type { DepartureQueue, DepartureWorkspace } from '@/features/editor/workspace/editor-departure-source'
import type { Guard } from '@/shared/admin/navigation-guard-context'
import { act, use, useEffect } from 'react'
import { afterEach, expect, it } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { emptyDocument } from '@/content/document'
import { acknowledgementSchema } from '@/contracts/documents'
import { DraftCoordinator } from '@/features/editor/draft/draft'
import { EditorBoundary } from '@/features/editor/workspace/editor-boundary'
import {
  useEditorDepartureAttachment,
  useEditorDeparturePermit,
} from '@/features/editor/workspace/editor-departure-context'
import { MediaUploadQueue } from '@/features/media/upload-queue'
import { BlogFrontend } from '@/i18n/frontend'
import { NavigationGuardProvider } from '@/shared/admin/navigation-guard'
import { NavigationGuardContext } from '@/shared/admin/navigation-guard-context'
import { button, click, one, text } from '~/tests/dom/shared/dom'
import { installBrowserShims, setMediaState, until } from '~/tests/dom/shared/environment'
import { mount, resetMounted, settle } from '~/tests/dom/shared/mount'

/**
 * The editor route's full-document boundary over the real departure policy,
 * dialog and guard context: a small structural workspace and a real draft
 * coordinator, no BlockNote and no editor session.
 *
 * jsdom performs fragment navigations, so a departure to a `#fragment`
 * destination is observable as the document navigation `location.assign`
 * performs, without stubbing jsdom's own location.
 */

const documentId = '11111111-1111-4111-8111-111111111111'
const headRevisionId = '22222222-2222-4222-8222-222222222222'
const preferencePolicy = createPreferencePolicy({ name: 'blog.dom.departure.v1', secure: false })

/** What the boundary published for the editor: its guard and its permit. */
const published: { guard: RefObject<Guard | null> | null, permit: DeparturePermit | null } = {
  guard: null,
  permit: null,
}

afterEach(() => {
  resetMounted()
  window.history.replaceState(null, '', window.location.pathname)
})

type Fixture = {
  workspace: DepartureWorkspace
  queue: DepartureQueue
  coordinator: DraftCoordinator
}

function fixture(save: () => Promise<void> = async () => await Promise.resolve()): Fixture {
  const ack = acknowledgementSchema.parse({
    documentId,
    version: 1,
    headRevisionId,
    liveRevisionId: null,
    liveGeneration: 0,
  })
  const coordinator = new DraftCoordinator(
    ack,
    async () => await Promise.resolve(emptyDocument()),
    async () => {
      await save()
      return ack
    },
    () => {},
  )
  return {
    coordinator,
    queue: new MediaUploadQueue<string>(async () => await Promise.resolve('uploaded'), () => {}),
    workspace: {
      busy: false,
      draft: {
        coordinator,
        persistLocal: async () => await Promise.resolve(true),
      },
      model: {
        composingRef: { current: false },
        hasUploads: () => false,
        waitUploads: async () => await Promise.resolve(),
      },
    },
  }
}

function Probe({ workspace, queue }: Fixture): ReactNode {
  const guard = use(NavigationGuardContext)
  const permit = useEditorDeparturePermit()
  useEffect(() => {
    published.guard = guard
    published.permit = permit
  }, [guard, permit])
  useEditorDepartureAttachment(workspace, queue)
  return <p>editor</p>
}

/** The entry before any workspace exists: the boundary alone. */
function LoadingEntry(): ReactNode {
  const guard = use(NavigationGuardContext)
  const permit = useEditorDeparturePermit()
  useEffect(() => {
    published.guard = guard
    published.permit = permit
  }, [guard, permit])
  return <p>loading</p>
}

function mountEditor(children: ReactNode): void {
  installBrowserShims()
  setMediaState({ width: 1440, dark: false, reducedMotion: false })
  mount(
    <BlogFrontend
      initialPreferences={{ version: 1, mode: 'light', palette: 'neutral', locale: 'en' }}
      policy={preferencePolicy}
    >
      <NavigationGuardProvider>
        <EditorBoundary>{children}</EditorBoundary>
      </NavigationGuardProvider>
    </BlogFrontend>,
  )
}

/**
 * The departure a guarded site link would hand to the boundary, with the waits it
 * triggers, inside `act` so its saving, error and idle phases are rendered.
 */
async function depart(href: string, wait: () => Promise<void>): Promise<void> {
  await act(async () => {
    published.guard?.current?.(href)
    await wait()
  })
}

async function arrived(hash: string): Promise<void> {
  await until(() => window.location.hash === hash)
}

async function dialogShown(): Promise<void> {
  await until(() => document.querySelector('[role="dialog"]') !== null)
}

async function failureShown(): Promise<void> {
  await until(() => document.querySelector('[role="dialog"] [role="alert"]') !== null)
}

it('navigates in the same document when the entry has not loaded a workspace', async () => {
  mountEditor(<LoadingEntry />)
  await settle()
  // Nothing is loaded, so nothing is waited for and no dialog opens.
  await depart('#not-loaded', async () => await arrived('#not-loaded'))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('saves before leaving and navigates only after the save settles', async () => {
  let release = (): void => {}
  const saved = new Promise<void>((resolve) => {
    release = resolve
  })
  const view = fixture(async () => await saved)
  mountEditor(<Probe {...view} />)
  await settle()
  act(() => view.coordinator.change())
  await depart('#saved', dialogShown)
  expect(text(document, '[role="dialog"]')).toContain('Saving before leaving')
  expect(window.location.hash).toBe('')
  await act(async () => {
    release()
    await arrived('#saved')
  })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  // jsdom's fragment navigation did not unload: no approval remains armed.
  expect(published.permit?.approved).toBe(false)
})

it('stays on a failed save and leaves only when the author accepts it', async () => {
  const view = fixture(async () => await Promise.reject(new Error('SAVE_FAILED')))
  mountEditor(<Probe {...view} />)
  await settle()
  act(() => view.coordinator.change())
  await depart('#refused', failureShown)
  const dialog = one(document, '[role="dialog"]')
  expect(text(dialog, '[role="alert"]')).toContain('Unable to save. Your local changes are kept.')
  expect(text(dialog, '[role="alert"]')).toContain('A local draft copy has been saved.')
  expect(button(dialog, 'Retry save').isConnected).toBe(true)
  expect(button(dialog, 'Leave without saving').isConnected).toBe(true)
  expect(window.location.hash).toBe('')

  act(() => {
    click(button(dialog, 'Stay here'))
  })
  await until(() => document.querySelector('[role="dialog"]') === null)
  expect(window.location.hash).toBe('')
  // Staying leaves the unload guards armed for the next browser navigation.
  expect(published.permit?.approved).toBe(false)

  await depart('#refused', failureShown)
  act(() => {
    click(button(one(document, '[role="dialog"]'), 'Leave without saving'))
  })
  await arrived('#refused')
  // Returning from a navigation without unloading never disables later warnings.
  expect(published.permit?.approved).toBe(false)
})
