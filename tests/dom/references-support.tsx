/* eslint-disable react-refresh/only-export-components -- Test support, not a Fast Refresh boundary. */
import type { ReactNode } from 'react'
import type { ApiHandler, ApiService } from './http'
import type { PublicationServer } from './publication-stub'
import type { Locale } from '@/components/ui/ztd-me'
import type { OpenDocument } from '@/contracts/documents'
import type { DocumentModel, Envelope } from '@/features/editor/workspace/document-model'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { act, useCallback, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { validateDocument } from '@/content/document'
import { useDraft } from '@/features/editor/draft/persistence'
import { nodes } from '@/features/editor/engine/native'
import { useSchedule, useScheduleList } from '@/features/editor/publication/schedule-controller'
import { ReferenceSettings } from '@/features/editor/references/reference-settings'
import { useActions } from '@/features/editor/workspace/actions'
import { BlogFrontend } from '@/i18n/frontend'
import { click, field, one, texts } from './dom'
import { installBrowserShims, setMediaState } from './environment'
import { serveFetch } from './http'
import { PublicationHeader } from './publication-header'
import { ReferenceSettingsLayout } from './references-settings-layout'

/*
 * The reference DOM surface: real reference components, form/author/lookup
 * controllers, draft coordinator, publication actions, client and i18n. The
 * BlockNote editor is the only excluded boundary; its schema-built initial
 * document and node references are read through the production model helpers.
 */

const owner = 'references-dom-owner'
const csrfToken = 'references-dom-csrf'
const preferencePolicy = createPreferencePolicy({
  name: 'blog.dom.references.v1',
  secure: false,
})

type ReferenceMount = {
  readonly initial: OpenDocument
  readonly locale?: Locale
  readonly width?: number
  readonly handlers: Readonly<Record<string, ApiHandler>>
  readonly publication?: PublicationServer
  readonly settingsLayout?: boolean
}

export type MountedReferences = {
  readonly container: HTMLElement
  readonly api: ApiService
  readonly unmount: () => void
}

const mounted: MountedReferences[] = []

function envelopeOf(document: OpenDocument['document']): Envelope {
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

function useReferenceModel(initial: OpenDocument, locale: Locale): DocumentModel {
  const [envelope, setEnvelope] = useState(() => envelopeOf(initial.document))
  const fieldsRef = useRef(envelope)
  const nodeItems = useMemo(() => nodes(initial.document), [initial.document])
  const composingRef = useRef(false)

  // useDraft only subscribes to BlockNote's lifecycle here. Contenteditable
  // transactions remain an engine-level assertion in the component/browser tests.
  // eslint-disable-next-line ts/no-unsafe-type-assertion -- The DOM layer mounts no BlockNote editor.
  const editor = useMemo(() => ({
    onChange: (): (() => void) => () => {},
  }) as unknown as DocumentModel['editor'], [])

  const snapshot = useCallback(async () => await Promise.resolve(
    validateDocument({ ...fieldsRef.current, blocks: initial.document.blocks }),
  ), [initial.document])

  const updateFields = useCallback((patch: Partial<Envelope>) => {
    fieldsRef.current = { ...fieldsRef.current, ...patch }
    setEnvelope(fieldsRef.current)
  }, [])

  return {
    editor,
    envelope,
    nodeItems,
    snapshot,
    composingRef,
    editorLocale: locale,
    pasteNotice: '',
    uploadFiles: async () => await Promise.resolve(''),
    uploading: false,
    hasUploads: () => false,
    waitUploads: async () => await Promise.resolve(),
    pastePlain: null,
    updateFields,
  }
}

function ReferenceSurface({
  initial,
  locale,
  publication,
  settingsLayout,
}: {
  initial: OpenDocument
  locale: Locale
  publication: PublicationServer | undefined
  settingsLayout: boolean | undefined
}): ReactNode {
  const model = useReferenceModel(initial, locale)
  const props = useMemo(() => ({
    initial,
    owner,
    csrfToken,
    reopen: () => {},
  }), [initial])
  const draft = useDraft({ initial, owner, csrfToken, model, recovered: false })
  const actions = useActions({ props, model, draft })
  const workspace: Workspace = {
    props,
    model,
    draft,
    busy: actions.busy,
    run: actions.run,
    perform: actions.perform,
  }
  const [open, setOpen] = useState(false)
  const updateFields = model.updateFields
  const changed = draft.changed
  const update = useCallback((patch: Partial<Envelope>) => {
    updateFields(patch)
    changed()
  }, [changed, updateFields])
  if (settingsLayout === true) {
    return <ReferenceSettingsLayout workspace={workspace} restore={actions.restore} update={update} />
  }
  return (
    <>
      {publication !== undefined && (
        <ReferencePublicationHeader
          workspace={workspace}
          actions={actions}
          publication={publication}
        />
      )}
      <ReferenceSettings workspace={workspace} update={update} open={open} setOpen={setOpen} />
    </>
  )
}

function ReferencePublicationHeader({
  workspace,
  actions,
  publication,
}: {
  workspace: Workspace
  actions: ReturnType<typeof useActions>
  publication: PublicationServer
}): ReactNode {
  const schedules = useScheduleList(workspace)
  const schedule = useSchedule(workspace, schedules)
  return (
    <PublicationHeader
      workspace={workspace}
      actions={actions}
      schedule={schedule}
      livePath={() => publication.open.livePath}
    />
  )
}

/** Mounts ReferenceSettings with its real draft and HTTP boundaries. */
export function mountReferences(input: ReferenceMount): MountedReferences {
  installBrowserShims()
  setMediaState({ width: input.width ?? 1440, reducedMotion: false, dark: false })
  const settingsHandlers: Readonly<Record<string, ApiHandler>> = input.settingsLayout === true
    ? {
        'GET /api/admin/documents/:id/schedule': () => ({ body: { items: [] } }),
        'GET /api/admin/catalog/tag': () => ({ body: { items: [] } }),
        'GET /api/admin/catalog/series': () => ({ body: { items: [] } }),
      }
    : {}
  const api = serveFetch({ ...settingsHandlers, ...input.handlers })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <BlogFrontend
        initialPreferences={{ version: 1, mode: 'light', palette: 'neutral', locale: input.locale ?? 'en' }}
        policy={preferencePolicy}
      >
        <ReferenceSurface
          initial={input.initial}
          locale={input.locale ?? 'en'}
          publication={input.publication}
          settingsLayout={input.settingsLayout}
        />
      </BlogFrontend>,
    )
  })
  let unmounted = false
  const view: MountedReferences = {
    container,
    api,
    unmount: () => {
      if (unmounted) {
        return
      }
      unmounted = true
      act(() => root.unmount())
      container.remove()
    },
  }
  mounted.push(view)
  return view
}

/** Unmounts surfaces, restores fetch, and fails on any undeclared route. */
export async function resetReferences(): Promise<void> {
  const views = mounted.splice(0)
  try {
    for (const view of views) {
      view.unmount()
    }
  }
  finally {
    for (const view of views.slice().reverse()) {
      view.api.dispose()
    }
    try {
      for (const view of views) {
        await view.api.expectServed()
      }
    }
    finally {
      setMediaState({ width: 1440, reducedMotion: false, dark: false })
    }
  }
}

export function openReferenceList(view: MountedReferences): void {
  const trigger = Array.from(view.container.querySelectorAll<HTMLButtonElement>('button'))
    .find(candidate => candidate.textContent.includes('References'))
  if (trigger === undefined) {
    throw new Error('The references accordion trigger was not rendered')
  }
  act(() => click(trigger))
}

export function clickText(root: ParentNode, label: string): void {
  const candidate = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(button => button.textContent.replaceAll(/\s+/g, ' ').trim() === label)
  if (candidate === undefined) {
    throw new Error(`No visible button had the text "${label}"`)
  }
  act(() => click(candidate))
}

export function clickLabeled(root: ParentNode, label: string): void {
  const candidate = one<HTMLButtonElement>(root, `button[aria-label="${label}"]`)
  act(() => click(candidate))
}

export function pasteText(input: HTMLElement, value: string): void {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (format: string) => format === 'text' ? value : '' },
  })
  act(() => {
    input.dispatchEvent(event)
  })
}

export function referenceEditor(): HTMLElement {
  return one(document.body, '[data-slot="reference-editor"]')
}

export function referenceForm(): HTMLFormElement {
  const forms = Array.from(referenceEditor().querySelectorAll<HTMLFormElement>('form'))
  const form = forms.find(candidate => candidate.querySelector('[data-author-input]') === null)
  if (form === undefined) {
    throw new Error('The reference form was not rendered')
  }
  return form
}

export function authorForm(): HTMLFormElement {
  const form = Array.from(referenceEditor().querySelectorAll<HTMLFormElement>('form'))
    .find(candidate => candidate.querySelector('[data-author-input]') !== null)
  if (form === undefined) {
    throw new Error('The author form was not rendered')
  }
  return form
}

export function referenceDialog(): HTMLElement {
  return one(document.body, '[role="dialog"]')
}

export function referenceField(label: string): HTMLElement {
  return field(referenceEditor(), label)
}

export function authorNames(root: ParentNode = referenceEditor()): string[] {
  return texts(root, '[data-author-name]')
}

export function authorRowNames(root: ParentNode = referenceEditor()): string[] {
  return texts(root, '[data-author-row] [data-author-name]')
}

export function control(root: ParentNode, selector: string): HTMLElement {
  return one(root, selector)
}
