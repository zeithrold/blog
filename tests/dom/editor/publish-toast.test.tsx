import type { ReactNode } from 'react'
import type { ActionWorkspace } from '@/features/editor/workspace/actions'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'
import { afterEach, expect, it } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { emptyDocument } from '@/content/document'
import { acknowledgementSchema, openDocumentSchema } from '@/contracts/documents'
import { DraftCoordinator } from '@/features/editor/draft/draft'
import { DraftErrorNotice } from '@/features/editor/draft/draft-error-notice'
import { useActions } from '@/features/editor/workspace/actions'
import { BlogFrontend } from '@/i18n/frontend'
import { Client } from '@/shared/admin/api-client'
import { button, click } from '~/tests/dom/shared/dom'
import { drainHostTask, installBrowserShims, setMediaState, until } from '~/tests/dom/shared/environment'
import { failure, serveFetch } from '~/tests/dom/shared/http'

/** Real actions, client, coordinator and Sonner; only fetch is replaced, with no BlockNote test host. */

const documentId = '11111111-1111-4111-8111-111111111111'
const headRevisionId = '22222222-2222-4222-8222-222222222222'
const preferencePolicy = createPreferencePolicy({ name: 'blog.dom.publish.v1', secure: false })

const mounted: Array<() => void> = []
const services: Array<ReturnType<typeof serveFetch>> = []

afterEach(() => {
  for (const unmount of mounted.splice(0)) {
    unmount()
  }
  act(() => {
    toast.dismiss()
  })
  for (const service of services.splice(0)) {
    service.dispose()
  }
})

type Fixture = {
  workspace: ActionWorkspace
  errors: string[]
  coordinator: DraftCoordinator
  composing: { current: boolean }
  reopened: ActionWorkspace['props']['initial'][]
}

function fixture(input: { live?: boolean } = {}): Fixture {
  const ack = acknowledgementSchema.parse({
    documentId,
    version: 3,
    headRevisionId,
    liveRevisionId: input.live === true ? headRevisionId : null,
    liveGeneration: input.live === true ? 1 : 0,
  })
  const coordinator = new DraftCoordinator(
    ack,
    async () => await Promise.resolve(emptyDocument()),
    async () => await Promise.resolve(ack),
    () => {},
  )
  const errors: string[] = []
  const composing = { current: false }
  const reopened: ActionWorkspace['props']['initial'][] = []
  const draft: ActionWorkspace['draft'] = {
    client: new Client('publish-csrf'),
    coordinator,
    setError: (message) => {
      errors.push(message)
    },
  }
  const model: ActionWorkspace['model'] = {
    composingRef: composing,
    waitUploads: async () => await Promise.resolve(),
  }
  const props = {
    initial: openDocumentSchema.parse({
      ...ack,
      kind: 'article',
      livePath: null,
      document: emptyDocument(),
    }),
    reopen: (document: ActionWorkspace['props']['initial']) => reopened.push(document),
  }
  return { workspace: { props, model, draft }, errors, coordinator, composing, reopened }
}

function Probe({ view }: { view: Fixture }): ReactNode {
  const actions = useActions(view.workspace)
  return (
    <>
      <button type="button" disabled={actions.busy} onClick={() => actions.run(actions.publish(), 'Published')}>
        publish
      </button>
      <button type="button" disabled={actions.busy} onClick={() => actions.run(actions.publish(true), 'Unpublished.')}>
        unpublish
      </button>
      <button
        type="button"
        disabled={actions.busy}
        onClick={() => actions.run(actions.restore(headRevisionId), 'Draft restored')}
      >
        restore
      </button>
      <DraftErrorNotice error={view.errors.at(-1) ?? ''} conflictShown={false} />
    </>
  )
}

function mount(view: Fixture): HTMLElement {
  installBrowserShims()
  setMediaState({ width: 1440, dark: false, reducedMotion: false })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <BlogFrontend
        initialPreferences={{ version: 1, mode: 'light', palette: 'neutral', locale: 'en' }}
        policy={preferencePolicy}
      >
        <Probe view={view} />
      </BlogFrontend>,
    )
  })
  mounted.push(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })
  return container
}

it('announces one confirmed publication and ignores a second click while it runs', async () => {
  const view = fixture()
  const api = serveFetch({
    [`POST /api/admin/documents/${documentId}/publish`]: () => ({
      body: {
        ...view.coordinator.acknowledgement,
        version: 4,
        liveRevisionId: headRevisionId,
        liveGeneration: 1,
      },
    }),
  })
  services.push(api)
  const container = mount(view)
  act(() => {
    click(button(container, 'publish'))
    click(button(container, 'publish'))
  })
  await act(async () => {
    await until(() => container.querySelector('[data-sonner-toast]') !== null)
    await drainHostTask()
  })
  const notices = container.querySelectorAll('[data-sonner-toast]')
  expect(notices).toHaveLength(1)
  expect(notice(container).textContent).toBe('Published')
  expect(notice(container).getAttribute('data-type')).toBe('success')
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  expect(api.calls[0]?.json).toEqual({
    expectedVersion: 3,
    expectedLiveGeneration: 0,
    revisionId: headRevisionId,
  })
  expect(view.coordinator.acknowledgement.liveRevisionId).toBe(headRevisionId)
  await api.expectServed()
})

it('keeps a refused publication in place without reporting success', async () => {
  const view = fixture()
  const api = serveFetch({
    [`POST /api/admin/documents/${documentId}/publish`]: () => failure(503, 'MAINTENANCE'),
  })
  services.push(api)
  const container = mount(view)
  act(() => {
    click(button(container, 'publish'))
  })
  await act(async () => {
    await until(() => view.errors.length === 1)
  })
  expect(view.errors).toEqual(['MAINTENANCE'])
  expect(container.querySelector('[data-sonner-toast]')).toBeNull()
  await api.expectServed()
})

it('does not publish or announce while the editor is composing', async () => {
  const view = fixture()
  view.composing.current = true
  const api = serveFetch({})
  services.push(api)
  const container = mount(view)
  act(() => {
    click(button(container, 'publish'))
  })
  await drainHostTask()
  expect(container.querySelector('[data-sonner-toast]')).toBeNull()
  expect(api.calls).toHaveLength(0)
  expect(view.errors).toEqual([])
})

it('does not announce a publication whose draft cannot settle', async () => {
  const view = fixture()
  view.coordinator.conflict()
  const api = serveFetch({})
  services.push(api)
  const container = mount(view)
  act(() => {
    click(button(container, 'publish'))
  })
  await drainHostTask()
  expect(container.querySelector('[data-sonner-toast]')).toBeNull()
  expect(api.calls).toHaveLength(0)
})

it('announces a confirmed unpublish with its own message', async () => {
  const view = fixture({ live: true })
  const api = serveFetch({
    [`POST /api/admin/documents/${documentId}/unpublish`]: () => ({
      body: {
        ...view.coordinator.acknowledgement,
        version: 4,
        liveRevisionId: null,
        liveGeneration: 2,
      },
    }),
  })
  services.push(api)
  const container = mount(view)
  act(() => {
    click(button(container, 'unpublish'))
  })
  await act(async () => {
    await until(() => container.querySelector('[data-sonner-toast]') !== null)
  })
  expect(notice(container).textContent).toBe('Unpublished.')
  expect(container.querySelectorAll('[data-sonner-toast]')).toHaveLength(1)
  expect(api.calls[0]?.path).toBe(`/api/admin/documents/${documentId}/unpublish`)
  expect(view.coordinator.acknowledgement.liveRevisionId).toBeNull()
  await api.expectServed()
})

it('preserves a confirmed restore when its re-read fails and blocks stale writes', async () => {
  const view = fixture()
  const restored = {
    ...view.coordinator.acknowledgement,
    version: 4,
    headRevisionId: '33333333-3333-4333-8333-333333333333',
  }
  const api = serveFetch({
    [`POST /api/admin/documents/${documentId}/restore`]: () => ({ body: restored }),
    [`GET /api/admin/documents/${documentId}`]: () => failure(503, 'MAINTENANCE'),
  })
  services.push(api)
  const container = mount(view)
  act(() => {
    click(button(container, 'restore'))
  })
  await act(async () => {
    await until(() => view.errors.includes('RESTORE_RELOAD_REQUIRED'))
    await until(() => container.querySelector('[data-sonner-toast]') !== null)
  })
  expect(notice(container).textContent).toBe('Draft restored')
  expect(container.querySelectorAll('[data-sonner-toast]')).toHaveLength(1)
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('The revision was restored')
  expect(button(container, 'Reload page')).toBeDefined()
  expect(button(container, 'publish').disabled).toBe(true)
  expect(view.coordinator.acknowledgement).toEqual(restored)
  expect(view.reopened).toHaveLength(0)
  view.coordinator.change()
  expect(await view.coordinator.flush()).toBe(false)
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  await api.expectServed()
})

it('reopens the accepted restored body and announces once after a successful re-read', async () => {
  const view = fixture()
  const ack = {
    ...view.coordinator.acknowledgement,
    version: 4,
    headRevisionId: '33333333-3333-4333-8333-333333333333',
  }
  const restored = {
    ...view.workspace.props.initial,
    ...ack,
    document: { ...emptyDocument(), meta: { ...emptyDocument().meta, title: 'Restored draft body' } },
  }
  const api = serveFetch({
    [`POST /api/admin/documents/${documentId}/restore`]: () => ({ body: ack }),
    [`GET /api/admin/documents/${documentId}`]: () => ({ body: restored }),
  })
  services.push(api)
  const container = mount(view)
  act(() => {
    click(button(container, 'restore'))
  })
  await act(async () => {
    await until(() => view.reopened.length === 1)
    await until(() => container.querySelector('[data-sonner-toast]') !== null)
  })
  expect(view.reopened[0]?.document.meta.title).toBe('Restored draft body')
  expect(view.errors).toEqual([])
  expect(notice(container).textContent).toBe('Draft restored')
  expect(container.querySelectorAll('[data-sonner-toast]')).toHaveLength(1)
  await api.expectServed()
})

function notice(container: HTMLElement): HTMLElement {
  const found = container.querySelector<HTMLElement>('[data-sonner-toast]')
  if (found === null) {
    throw new Error('No notification rendered')
  }
  return found
}
