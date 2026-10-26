/* eslint-disable react-refresh/only-export-components -- Test support, not a Fast Refresh boundary. */
import type { ReactNode } from 'react'
import type { ConflictCopy, HeldReply } from './history-conflict-remaining-fixtures'
import type { Stub, StubRoute } from './publication-stub'
import type { FrontendPreferences, Locale } from '@/components/ui/ztd-me'
import type { Document } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import type { DocumentModel, Envelope } from '@/features/editor/workspace/document-model'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { act, useCallback, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { validateDocument } from '@/content/document'
import { DraftNotices } from '@/features/editor/draft/notices'
import { useDraft } from '@/features/editor/draft/persistence'
import { nodes } from '@/features/editor/engine/native'
import { useActions } from '@/features/editor/workspace/actions'
import { BlogFrontend } from '@/i18n/frontend'
import { conflictDocuments } from './history-conflict-remaining-fixtures'
import { installBrowserShims } from './publication-dom'
import { envelopeOf } from './publication-editor-boundary'
import { failure, serveFetch } from './publication-stub'

/*
 * The draft-conflict half of the DOM pilot: the real draft coordinator, client,
 * conflict notice, comparison and diff render here, with only `fetch` replaced
 * by a case's table.
 *
 * The BlockNote editor is the one product surface this layer excludes, exactly as
 * the publication pilot excludes it. `useConflictBoundary` supplies the document
 * data, the snapshot and the change hook the real controllers read; it holds no
 * draft, conflict or diff rule, and writing a paragraph is the one content
 * transaction the author's typing would deliver.
 */

const owner = 'dom-conflict-owner'
const csrfToken = 'dom-conflict-csrf'
const preferencePolicy = createPreferencePolicy({
  name: 'blog.dom.conflict.v1',
  secure: false,
})

type ChangeListener = (editor: unknown, transaction: unknown) => void

/**
 * The editor's change channel: one content transaction reaches every listener the
 * draft controller and the comparison registered through `onChange`.
 */
function useEditorChannel(): { editor: DocumentModel['editor'], emit: () => void } {
  const listenersRef = useRef(new Set<ChangeListener>())
  const editor = useMemo(() => {
    const boundary = {
      onChange: (listener: ChangeListener) => {
        listenersRef.current.add(listener)
        return () => {
          listenersRef.current.delete(listener)
        }
      },
    }
    // eslint-disable-next-line ts/no-unsafe-type-assertion -- jsdom mounts no BlockNote editor.
    return boundary as unknown as DocumentModel['editor']
  }, [])
  const emit = useCallback(() => {
    const transaction = { getChanges: () => [
      {},
    ] }
    for (const listener of listenersRef.current) {
      listener(editor, transaction)
    }
  }, [editor])
  return { editor, emit }
}

function useConflictBoundary(initial: OpenDocument): {
  model: DocumentModel
  writeParagraph: (text: string) => void
} {
  const [envelope, setEnvelope] = useState<Envelope>(() => envelopeOf(initial.document))
  const envelopeRef = useRef(envelope)
  const blocksRef = useRef(initial.document.blocks)
  const nodeItems = useMemo(() => nodes(initial.document), [initial.document])
  const composingRef = useRef(false)
  const { editor, emit } = useEditorChannel()
  const snapshot = useCallback(
    async (): Promise<Document> => await Promise.resolve(
      validateDocument({ ...envelopeRef.current, blocks: blocksRef.current }),
    ),
    [],
  )
  const updateFields = useCallback((patch: Partial<Envelope>) => {
    // Production updates the ref before the state so a save started by the same
    // interaction snapshots the edit it just made.
    envelopeRef.current = { ...envelopeRef.current, ...patch }
    setEnvelope(envelopeRef.current)
  }, [])
  const writeParagraph = useCallback((text: string) => {
    const blocks = structuredClone(blocksRef.current)
    const block = blocks[0]
    if (block === undefined) {
      throw new Error('The conflict fixture has no paragraph')
    }
    block.content = [
      { type: 'text', text, styles: {} },
    ]
    blocksRef.current = blocks
    // One content transaction, as BlockNote delivers it to `onChange`.
    emit()
  }, [emit])
  return {
    model: {
      editor,
      envelope,
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
    writeParagraph,
  }
}

export type ConflictProbe = {
  readonly workspace: Workspace
  readonly writeParagraph: (text: string) => void
  /** Reopen calls this mount saw; a recovery copy that cannot be written must leave it at 0. */
  readonly reopenCount: () => number
}

export type ConflictMount = {
  readonly locale: Locale
  /** Holds the newer-draft read so the pending notice is observable. */
  readonly refresh?: HeldReply
}

export type MountedConflict = {
  readonly stub: Stub
  readonly container: HTMLElement
  readonly state: () => ConflictProbe
  /** One content transaction, as the author's paragraph reaches the editor. */
  readonly writeParagraph: (text: string) => void
  readonly unmount: () => void
}

function conflictHandlers(remote: OpenDocument, refresh?: HeldReply): Record<string, StubRoute> {
  return {
    // The server refuses the save of a draft another window already replaced.
    'PUT /api/admin/documents/:id/revisions': () => failure(409, 'EDIT_CONFLICT'),
    // The newer draft the notice reads; held only when the case needs it pending.
    'GET /api/admin/documents/:id': async () => {
      await refresh?.promise
      return { body: remote }
    },
  }
}

function preferences(locale: Locale): FrontendPreferences {
  return { version: 1, mode: 'light', palette: 'neutral', locale }
}

const views: MountedConflict[] = []
const activeStubs: Stub[] = []

type Surface = {
  container: HTMLElement
  root: ReturnType<typeof createRoot>
  state: () => ConflictProbe
}

function ConflictSurface({ initial, onProbe }: {
  initial: OpenDocument
  onProbe: (probe: ConflictProbe) => void
}): ReactNode {
  const boundary = useConflictBoundary(initial)
  const model = boundary.model
  const [reopens, setReopens] = useState(0)
  const props = useMemo(() => ({
    initial,
    owner,
    csrfToken,
    // Counted, never synthesised: reopening the server draft remounts the live
    // editor body, which is the component case's. The count is how a failed
    // recovery copy proves it did not reopen.
    reopen: () => {
      setReopens(count => count + 1)
    },
  }), [initial])
  const draft = useDraft({
    initial,
    owner,
    csrfToken,
    model,
    recovered: false,
  })
  const actions = useActions({ props, model, draft })
  const [resolving, setResolving] = useState(false)
  const workspace: Workspace = {
    props,
    model,
    draft,
    busy: actions.busy || resolving,
    run: actions.run,
    perform: actions.perform,
  }
  onProbe({
    workspace,
    writeParagraph: boundary.writeParagraph,
    reopenCount: () => reopens,
  })
  return <DraftNotices workspace={workspace} setResolving={setResolving} />
}

function renderSurface(initial: OpenDocument, locale: Locale): Surface {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  let latest: ConflictProbe | null = null
  act(() => {
    root.render(
      <BlogFrontend initialPreferences={preferences(locale)} policy={preferencePolicy}>
        <ConflictSurface
          initial={initial}
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
        throw new Error('The conflict surface never rendered')
      }
      return latest
    },
  }
}

/** Mounts the real draft controller and conflict notice in jsdom. */
export function mountConflict(input: ConflictMount): MountedConflict {
  installBrowserShims()
  const { local, remote } = conflictDocuments()
  const stub = serveFetch(conflictHandlers(remote, input.refresh))
  activeStubs.push(stub)
  const { container, root, state } = renderSurface(local, input.locale)
  let unmounted = false
  const mounted: MountedConflict = {
    stub,
    container,
    state,
    writeParagraph: (text) => {
      act(() => {
        state().writeParagraph(text)
      })
    },
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
export function resetConflictDom(): void {
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

const uuidPattern = /[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/gi

/** Every request this case sent, as `METHOD /path/:id`, so writes are named not counted. */
export function requestRoutes(view: MountedConflict): string[] {
  return view.stub.calls.map(call => `${call.method} ${call.path.replace(uuidPattern, ':id')}`)
}

/** Every request that was not a read: what the notice, comparison and decisions wrote. */
export function writeRoutes(view: MountedConflict): string[] {
  return view.stub.calls
    .filter(call => call.method !== 'GET')
    .map(call => `${call.method} ${call.path.replace(uuidPattern, ':id')}`)
}

/** Publication writes only: what a draft conflict decision must never send. */
export function publicationWrites(view: MountedConflict): string[] {
  return writeRoutes(view).filter(route => /\/(?:publish|unpublish|restore)$/.test(route))
}

/** Every conflict-tone notice on the surface; a resolved conflict owns exactly one. */
export function notices(root: ParentNode, tone: 'conflict' | 'error' | 'recovery'): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`.editor-notice[data-tone="${tone}"]`))
}

/** The notice whose heading is `title`, or null while that notice is not rendered. */
export function noticeByTitle(root: ParentNode, title: string): HTMLElement | null {
  const found = Array.from(root.querySelectorAll<HTMLElement>('.editor-notice'))
    .find(element => element.querySelector('.editor-notice-title')?.textContent.trim() === title)
  return found ?? null
}

/** The notice with this heading, failing with what rendered instead. */
export function requiredNotice(root: ParentNode, title: string): HTMLElement {
  const found = noticeByTitle(root, title)
  if (found !== null) {
    return found
  }
  const rendered = Array.from(root.querySelectorAll('.editor-notice-title'))
    .map(item => JSON.stringify(item.textContent.trim()))
    .join(', ')
  throw new Error(`No notice titled ${JSON.stringify(title)}. Rendered: ${rendered}`)
}

/** The one conflict choice with this accessible name. */
export function actionButton(root: ParentNode, label: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll('button'))
    .find(element => element.getAttribute('aria-label') === label)
  if (found === undefined) {
    throw new Error(`No conflict action labelled ${JSON.stringify(label)}`)
  }
  return found
}

/** The revision-difference region a comparison renders, or null when it is closed. */
export function differences(root: ParentNode, copy: ConflictCopy): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[aria-label="${copy.differences}"]`)
}

/** The paragraph the document currently holds, as the editor would snapshot it. */
export function paragraphOf(document: Document): unknown {
  return document.blocks[0]?.content
}
