/* eslint-disable react-refresh/only-export-components -- DOM-layer support, not a Fast Refresh boundary. */
import type { ReactNode } from 'react'
import type { ApiHandler, ApiService } from './http'
import type { Locale } from '@/components/ui/ztd-me'
import type { Document } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import type { DocumentModel, Envelope } from '@/features/editor/workspace/document-model'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { act, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SiteShell } from '@/components/site-shell'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { validateDocument } from '@/content/document'
import { catalogListSchema } from '@/contracts/catalog'
import { openDocumentSchema } from '@/contracts/documents'
import { scheduleListSchema } from '@/contracts/publication'
import { DraftNotices } from '@/features/editor/draft/notices'
import { useDraft } from '@/features/editor/draft/persistence'
import { nodes } from '@/features/editor/engine/native'
import { DraftPreviewProvider } from '@/features/editor/preview/live-preview'
import { useScheduleList } from '@/features/editor/publication/schedule-controller'
import { useActions } from '@/features/editor/workspace/actions'
import { EditorHeader } from '@/features/editor/workspace/header'
import { EditorSettings } from '@/features/editor/workspace/settings'
import { BlogFrontend } from '@/i18n/frontend'
import { COMPONENT_TEST_FIXTURES } from '~/tests/components/src/fixtures'
import { editorWorkspaceDocument } from '~/tests/components/support/editor-workspace-fixtures'
import { installBrowserShims, setMediaState } from './environment'
import { serveFetch } from './http'

export type EditorChromeProbe = {
  readonly workspace: Workspace
  readonly actions: ReturnType<typeof useActions>
  readonly schedules: ReturnType<typeof useScheduleList>
}

export type MountedEditorChrome = {
  readonly container: HTMLElement
  readonly api: ApiService
  state: () => EditorChromeProbe
  unmount: () => void
}

const owner = COMPONENT_TEST_FIXTURES.owner
const csrfToken = COMPONENT_TEST_FIXTURES.csrfToken
const mounted: MountedEditorChrome[] = []
const activeApis: ApiService[] = []
let nextPolicy = 1

type ChangeListener = (editor: unknown, transaction: unknown) => void

function envelopeOf(document: Document): Envelope {
  return {
    format: document.format,
    schemaVersion: document.schemaVersion,
    blockSchema: document.blockSchema,
    meta: document.meta,
    references: document.references,
    citationStyle: document.citationStyle,
    mediaAccessibility: document.mediaAccessibility,
    tableAccessibility: document.tableAccessibility,
  }
}

/**
 * Supplies document data and a change listener only; production hooks remain real.
 * No BlockNote editor is mounted.
 */
function useEditorBoundary(initial: OpenDocument): {
  model: DocumentModel
} {
  const [fields, setFields] = useState(() => envelopeOf(initial.document))
  const fieldsRef = useRef(fields)
  const nodeItems = useMemo(() => nodes(initial.document), [initial.document])
  const listenersRef = useRef(new Set<ChangeListener>())
  const composingRef = useRef(false)
  const snapshot = useMemo(() => async (): Promise<Document> => await Promise.resolve(
    validateDocument({ ...fieldsRef.current, blocks: initial.document.blocks }),
  ), [initial.document])
  const editor = useMemo(() => {
    const boundary = {
      onChange: (listener: ChangeListener) => {
        listenersRef.current.add(listener)
        return () => void listenersRef.current.delete(listener)
      },
      focus: () => {
        throw new Error('Native BlockNote focus is outside the editor chrome DOM boundary')
      },
    }
    // eslint-disable-next-line ts/no-unsafe-type-assertion -- jsdom intentionally mounts no BlockNote editor.
    return boundary as unknown as DocumentModel['editor']
  }, [])
  const updateFields = (patch: Partial<Envelope>): void => {
    fieldsRef.current = { ...fieldsRef.current, ...patch }
    setFields(fieldsRef.current)
  }
  return {
    model: {
      editor,
      envelope: fields,
      nodeItems,
      snapshot,
      composingRef,
      editorLocale: 'en',
      pasteNotice: '',
      uploadFiles: async () => await Promise.resolve(''),
      uploading: false,
      hasUploads: () => false,
      waitUploads: async () => await Promise.resolve(),
      pastePlain: null,
      updateFields,
    },
  }
}
const preferences = (locale: Locale) => ({ version: 1, mode: 'light', palette: 'neutral', locale } as const)

function EditorChromeSurface({
  initial,
  locale,
  showNotices,
  policy,
  workspace,
  actions,
  schedules,
  update,
  setResolving,
}: {
  initial: OpenDocument
  locale: Locale
  showNotices: boolean
  policy: ReturnType<typeof createPreferencePolicy>
  workspace: Workspace
  actions: ReturnType<typeof useActions>
  schedules: ReturnType<typeof useScheduleList>
  update: (patch: Partial<Envelope>) => void
  setResolving: (busy: boolean) => void
}): ReactNode {
  return (
    <BlogFrontend initialPreferences={preferences(locale)} policy={policy}>
      <SiteShell>
        <DraftPreviewProvider workspace={workspace}>
          <section className="workspace">
            {showNotices && <DraftNotices workspace={workspace} setResolving={setResolving} />}
            <EditorHeader
              workspace={workspace}
              {...actions}
              livePath={initial.livePath}
              schedules={schedules.data?.items ?? []}
            />
            <EditorSettings
              workspace={workspace}
              update={update}
              restore={actions.restore}
              livePath={initial.livePath}
              schedules={schedules}
            />
          </section>
        </DraftPreviewProvider>
      </SiteShell>
    </BlogFrontend>
  )
}

function EditorChromeHarness({
  initial,
  locale,
  showNotices,
  policy,
  onProbe,
}: {
  initial: OpenDocument
  locale: Locale
  showNotices: boolean
  policy: ReturnType<typeof createPreferencePolicy>
  onProbe: (probe: EditorChromeProbe) => void
}): ReactNode {
  const boundary = useEditorBoundary(initial)
  const [resolving, setResolving] = useState(false)
  const props = useMemo(() => ({
    initial,
    owner,
    csrfToken,
    reopen: (_document: OpenDocument) => {
      throw new Error('Session replacement is outside the editor chrome DOM boundary')
    },
  }), [initial])
  const draft = useDraft({
    initial,
    owner,
    csrfToken,
    model: boundary.model,
    recovered: false,
  })
  const actions = useActions({ props, model: boundary.model, draft })
  const workspace: Workspace = {
    props,
    model: boundary.model,
    draft,
    busy: actions.busy || resolving,
    run: actions.run,
    perform: actions.perform,
  }
  const schedules = useScheduleList(workspace)
  const update = (patch: Partial<Envelope>): void => {
    boundary.model.updateFields(patch)
    draft.changed()
  }
  onProbe({ workspace, actions, schedules })
  return (
    <EditorChromeSurface
      initial={initial}
      locale={locale}
      showNotices={showNotices}
      policy={policy}
      workspace={workspace}
      actions={actions}
      schedules={schedules}
      update={update}
      setResolving={setResolving}
    />
  )
}

function mountedView(
  container: HTMLElement,
  api: ApiService,
  root: ReturnType<typeof createRoot>,
  getState: () => EditorChromeProbe,
): MountedEditorChrome {
  let disposed = false
  return {
    container,
    api,
    state: getState,
    unmount: () => {
      if (disposed) {
        return
      }
      disposed = true
      act(() => root.unmount())
      container.remove()
    },
  }
}

/** Mounts the production editor header/settings/controllers without BlockNote. */
export async function mountEditorChrome(input: {
  initial?: OpenDocument
  width?: number
  locale?: Locale
  showNotices?: boolean
  handlers?: Readonly<Record<string, ApiHandler>>
} = {}): Promise<MountedEditorChrome> {
  installBrowserShims()
  setMediaState({
    width: input.width ?? 1440,
    reducedMotion: false,
    dark: false,
  })
  const initial = input.initial ?? editorWorkspaceDocument()
  window.history.replaceState({}, '', `/admin/documents/${initial.documentId}`)
  const policy = createPreferencePolicy({
    name: `blog.dom.editor-chrome.${nextPolicy++}.v1`,
    secure: false,
  })
  const defaults: Record<string, ApiHandler> = {
    'GET /api/admin/documents/:id': () => ({ body: openDocumentSchema.parse(initial) }),
    'GET /api/admin/documents/:id/schedule': () => ({ body: scheduleListSchema.parse({ items: [] }) }),
    'GET /api/admin/catalog/tag': () => ({ body: catalogListSchema.parse({ items: [] }) }),
    'GET /api/admin/catalog/series': () => ({ body: catalogListSchema.parse({ items: [] }) }),
  }
  const api = serveFetch({ ...defaults, ...input.handlers })
  activeApis.push(api)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  let latest: EditorChromeProbe | null = null
  await act(async () => {
    root.render(
      <EditorChromeHarness
        initial={initial}
        locale={input.locale ?? 'en'}
        showNotices={input.showNotices ?? false}
        policy={policy}
        onProbe={(probe) => {
          latest = probe
        }}
      />,
    )
    await api.settle()
  })
  const view = mountedView(container, api, root, () => {
    if (latest === null) {
      throw new Error('The editor chrome surface never rendered')
    }
    return latest
  })
  mounted.push(view)
  return view
}

/** Unmounts every surface, restores fetch and fails on an undeclared request. */
export async function resetEditorChrome(): Promise<void> {
  try {
    for (const view of mounted.splice(0)) {
      view.unmount()
    }
  }
  finally {
    const apis = activeApis.splice(0)
    for (const api of apis.slice().reverse()) {
      api.dispose()
    }
    for (const api of apis) {
      await api.expectServed()
    }
    window.history.replaceState({}, '', '/')
  }
}
