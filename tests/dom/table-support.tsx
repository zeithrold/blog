/* eslint-disable react-refresh/only-export-components -- Test support, not a Fast Refresh boundary. */
import type { PublicationServer } from './publication-stub'
import type { FrontendPreferences, Locale } from '@/components/ui/ztd-me'
import type { Block, Document } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import type { TableTarget } from '@/features/editor/blocks/table/table-controls-model'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { act, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { emptyDocument, validateDocument } from '@/content/document'
import { table as tableSchema } from '@/content/table-schema'
import { openDocumentSchema, saveSchema } from '@/contracts/documents'
import { TableCaption } from '@/features/editor/blocks/table/table-caption'
import { useDraft } from '@/features/editor/draft/persistence'
import { DraftPreviewContext } from '@/features/editor/preview/draft-preview-context'
import { useScheduleList } from '@/features/editor/publication/schedule-controller'
import { useActions } from '@/features/editor/workspace/actions'
import { EditorSettings } from '@/features/editor/workspace/settings'
import { BlogFrontend } from '@/i18n/frontend'
import { SaveStatus } from '@/shared/admin/save-status'
import { installBrowserShims, setMediaState } from './environment'
import * as domHttp from './http'
import { useEditorBoundary } from './publication-editor-boundary'
import { acceptSave } from './publication-stub'

export const firstTableId = '11111111-1111-4111-8111-111111111111'
export const secondTableId = '22222222-2222-4222-8222-222222222222'

const documentId = '33333333-3333-4333-8333-333333333333'
const headRevisionId = '44444444-4444-4444-8444-444444444444'
const owner = 'dom-table-owner'
const csrfToken = 'dom-table-csrf'
const preferencePolicy = createPreferencePolicy({
  name: 'blog.dom.tables.v1',
  secure: false,
})
const draftPreview = { show: () => {} }

export type MountedTable = {
  readonly initial: OpenDocument
  readonly container: HTMLElement
  readonly api: domHttp.ApiService
  readonly unmount: () => void
}

const views: MountedTable[] = []

type TableSurfaceProps = {
  initial: OpenDocument
}

/**
 * A schema-validated two-table document shared by the real caption component,
 * document model, and draft controller. These declared blocks are data only;
 * no table editing rule is implemented in the fixture.
 */
export function tableDocument(): OpenDocument {
  const document = emptyDocument()
  document.meta.title = 'Table captions'
  document.meta.slug = 'table-captions'
  document.blocks = [
    captionTable(firstTableId, 'First cell', 'First table peer'),
    captionTable(secondTableId, 'Second First cell', 'Second table peer'),
  ]
  return openDocumentSchema.parse({
    documentId,
    version: 0,
    headRevisionId,
    liveRevisionId: null,
    liveGeneration: 0,
    kind: 'article',
    livePath: null,
    document,
  })
}

function captionTable(id: string, first: string, second: string): Block {
  return {
    id,
    type: 'table',
    props: { textColor: 'default' },
    content: tableSchema.parse({
      type: 'tableContent',
      columnWidths: [120, 120],
      rows: [
        {
          cells: [
            [
              { type: 'text', text: first, styles: {} },
            ],
            [
              { type: 'text', text: second, styles: {} },
            ],
          ],
        },
      ],
    }),
    children: [],
  }
}

/** A TableTarget carrying declared DOM data; this helper measures no geometry. */
export function tableTarget(id: string, table: HTMLTableElement): TableTarget {
  const wrapper = document.createElement('div')
  const viewport = document.createElement('div')
  const widgets = document.createElement('div')
  viewport.append(table)
  wrapper.append(viewport, widgets)
  return { id, table, viewport, wrapper, widgets }
}

/** Mounts real table captions, editor settings, workspace hooks and save client. */
export async function mountTableSurface(locale: Locale = 'en'): Promise<MountedTable> {
  installBrowserShims()
  setMediaState({ width: 1440 })
  const initial = tableDocument()
  const server: PublicationServer = { open: initial, items: [] }
  const api = domHttp.serveFetch(tableHandlers(server))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    act(() => {
      root.render(
        <BlogFrontend initialPreferences={preferences(locale)} policy={preferencePolicy}>
          <TableSurface initial={initial} />
        </BlogFrontend>,
      )
    })
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
      await api.expectServed()
    })
  }
  catch (error: unknown) {
    act(() => {
      root.unmount()
    })
    container.remove()
    api.dispose()
    throw error
  }

  let unmounted = false
  const mounted: MountedTable = {
    initial,
    container,
    api,
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

function TableSurface({ initial }: TableSurfaceProps): React.ReactNode {
  const boundary = useEditorBoundary(initial)
  const model = boundary.model
  const props = useMemo(() => ({
    initial,
    owner,
    csrfToken,
    reopen: () => {},
  }), [initial])
  const draft = useDraft({
    initial,
    owner,
    csrfToken,
    model,
    recovered: false,
  })
  const actions = useActions({ props, model, draft })
  const workspace: Workspace = {
    props,
    model,
    draft,
    busy: actions.busy,
    run: actions.run,
    perform: actions.perform,
  }
  const schedules = useScheduleList(workspace)

  return (
    <>
      <section aria-label="Table captions">
        {[firstTableId, secondTableId].map(id => (
          <div className="table-caption-target" data-table-id={id} key={id}>
            <TableCaption
              workspace={workspace}
              target={tableTarget(id, document.createElement('table'))}
              width={480}
            />
          </div>
        ))}
      </section>
      <SaveStatus status={draft.status} className="save-status" />
      <DraftPreviewContext value={draftPreview}>
        <EditorSettings
          workspace={workspace}
          update={model.updateFields}
          restore={async () => {
            await Promise.resolve()
          }}
          livePath={null}
          schedules={schedules}
        />
      </DraftPreviewContext>
    </>
  )
}

function preferences(locale: Locale): FrontendPreferences {
  return { version: 1, mode: 'light', palette: 'neutral', locale }
}

function tableHandlers(server: PublicationServer): Readonly<Record<string, domHttp.ApiHandler>> {
  return {
    'GET /api/admin/catalog/tag': () => ({ body: { items: [] } }),
    'GET /api/admin/catalog/series': () => ({ body: { items: [] } }),
    'GET /api/admin/documents/:id/schedule': () => ({ body: { items: [] } }),
    'PUT /api/admin/documents/:id/revisions': (call) => {
      const reply = acceptSave(server, {
        method: call.method,
        path: call.path,
        query: call.query,
        body: call.json,
        headers: call.headers,
      })
      return reply === 'disconnected' ? { abort: 'failed' } satisfies domHttp.ApiReply : reply
    },
  }
}

function revisionCalls(api: domHttp.ApiService): domHttp.ApiCall[] {
  return api.calls.filter(call =>
    domHttp.apiKey(call.method, call.path) === 'PUT /api/admin/documents/:id/revisions')
}

export function revisionCount(api: domHttp.ApiService): number {
  return revisionCalls(api).length
}

/** Flushes a real draft edit through the real client and returns its request body. */
export async function saveTableDraft(view: MountedTable, before: number): Promise<Document> {
  act(() => {
    window.dispatchEvent(new Event('online'))
  })
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    await view.api.expectServed()
  })
  if (revisionCount(view.api) <= before
    || view.container.querySelector('.save-status')?.getAttribute('data-status') !== 'saved') {
    throw new Error('The table edit did not finish its declared revision save')
  }
  const call = revisionCalls(view.api).at(-1)
  if (call === undefined) {
    throw new Error('The table edit sent no revision request')
  }
  return validateDocument(saveSchema.parse(call.json).document)
}

/** Unmounts every mounted table surface and restores each declared fetch table. */
export function resetDomTables(): void {
  const mounted = views.splice(0)
  try {
    for (const view of mounted.slice().reverse()) {
      view.unmount()
    }
  }
  finally {
    for (const view of mounted.slice().reverse()) {
      view.api.dispose()
    }
  }
}

afterEach(resetDomTables)
