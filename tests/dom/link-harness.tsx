import type { ApiHandler, ApiService } from './http'
import type { OpenDocument } from '@/contracts/documents'
import { BlockNoteEditor } from '@blocknote/core'
import { en, zh } from '@blocknote/core/locales'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { nativeBlocks } from '@/features/editor/engine/native'
import { editorSchema } from '@/features/editor/engine/schema'
import {
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
  paragraphBlock,
} from '~/tests/components/support/editor-workspace-fixtures'
import { installBrowserShims, setMediaState, until } from './environment'
import { serveFetch } from './http'
import { LinkHarness } from './link-harness-surface'

export type MountedLinkEditor = {
  readonly container: HTMLDivElement
  readonly initial: OpenDocument
  readonly editor: typeof editorSchema.BlockNoteEditor
  readonly api: ApiService
  unmount: () => void
}

type LinkEditorOptions = {
  readonly document?: OpenDocument
  readonly width?: number
  readonly locale?: 'en' | 'zh'
  readonly mode?: 'light' | 'dark'
  readonly handlers?: Readonly<Record<string, ApiHandler>>
}

type LinkHost = {
  readonly initial: OpenDocument
  readonly locale: 'en' | 'zh'
  readonly mode: 'light' | 'dark'
}

type MountedLinkEditorInput = {
  readonly container: HTMLDivElement
  readonly initial: OpenDocument
  readonly editor: typeof editorSchema.BlockNoteEditor
  readonly api: ApiService
  readonly root: ReturnType<typeof createRoot>
}

const mounted: MountedLinkEditor[] = []
let nextPolicy = 1

function defaultDocument(): OpenDocument {
  return editorWorkspaceDocument('Link interaction', (document) => {
    document.blocks = [
      paragraphBlock('Before Selected link untouched suffix'),
    ]
  })
}

function createEditor(initial: OpenDocument, locale: 'en' | 'zh'): typeof editorSchema.BlockNoteEditor {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: nativeBlocks(initial.document),
    dictionary: locale === 'zh' ? zh : en,
    domAttributes: {
      editor: {
        'aria-label': locale === 'zh' ? '正文' : 'Document body',
      },
    },
  })
}

function createPolicy(): ReturnType<typeof createPreferencePolicy> {
  return createPreferencePolicy({
    name: `blog.dom.links.${nextPolicy++}.v1`,
    secure: false,
  })
}

function installRangeLayoutFacts(): void {
  if (typeof Range.prototype.getClientRects !== 'function') {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [],
    })
  }
  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(0, 0, 0, 0),
    })
  }
}

function installViewport(): void {
  if (document.head.querySelector('meta[name="viewport"]') !== null) {
    return
  }
  const viewport = document.createElement('meta')
  viewport.name = 'viewport'
  viewport.content = 'width=device-width, initial-scale=1, interactive-widget=resizes-content'
  document.head.append(viewport)
}

function prepareLinkHost(options: LinkEditorOptions): LinkHost {
  installBrowserShims()
  installRangeLayoutFacts()
  installViewport()
  const initial = options.document ?? defaultDocument()
  const locale = options.locale ?? 'en'
  const mode = options.mode ?? 'light'
  setMediaState({
    width: options.width ?? 1440,
    reducedMotion: false,
    dark: mode === 'dark',
  })
  window.history.replaceState({}, '', `/admin/documents/${initial.documentId}`)
  return { initial, locale, mode }
}

function mountedView(input: MountedLinkEditorInput): MountedLinkEditor {
  let disposed = false
  return {
    container: input.container,
    initial: input.initial,
    editor: input.editor,
    api: input.api,
    unmount: () => {
      if (disposed) {
        return
      }
      disposed = true
      act(() => input.root.unmount())
      input.container.remove()
    },
  }
}

async function renderLinkHarness(input: {
  readonly root: ReturnType<typeof createRoot>
  readonly container: HTMLDivElement
  readonly initial: OpenDocument
  readonly editor: typeof editorSchema.BlockNoteEditor
  readonly locale: 'en' | 'zh'
  readonly mode: 'light' | 'dark'
}): Promise<void> {
  act(() => {
    input.root.render(
      <LinkHarness
        initial={input.initial}
        editor={input.editor}
        locale={input.locale}
        mode={input.mode}
        policy={createPolicy()}
      />,
    )
  })
  await act(async () => {
    await until(() => input.container.querySelector('.ProseMirror') !== null)
  })
}

/** Mounts real BlockNote, formatting/link controls, editor actions, hooks and the draft Client. */
export async function mountLinkEditor(options: LinkEditorOptions = {}): Promise<MountedLinkEditor> {
  const host = prepareLinkHost(options)
  const editor = createEditor(host.initial, host.locale)
  const api = serveFetch({
    'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
    ...options.handlers,
  })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await renderLinkHarness({
      root,
      container,
      initial: host.initial,
      editor,
      locale: host.locale,
      mode: host.mode,
    })
    await api.expectServed()
    const view = mountedView({ container, initial: host.initial, editor, api, root })
    mounted.push(view)
    return view
  }
  catch (error: unknown) {
    const surface = container.querySelector('.ProseMirror')?.outerHTML ?? 'missing editor'
    const requests = api.calls.map(call => `${call.method} ${call.path}`).join(', ')
    const unhandled = api.unhandled.join(', ')
    const requestSummary = requests.length === 0 ? 'none' : requests
    const unhandledSummary = unhandled.length === 0 ? 'none' : unhandled
    act(() => root.unmount())
    container.remove()
    api.dispose()
    const message = error instanceof Error ? error.message : 'Editor mount failed'
    throw new Error(`${message}; editor=${surface}; requests=${requestSummary}; unhandled=${unhandledSummary}`)
  }
}

export function editorBody(view: MountedLinkEditor): HTMLElement {
  const body = view.container.querySelector<HTMLElement>('.ProseMirror')
  if (body === null) {
    throw new Error('The production editor did not render its BlockNote body')
  }
  return body
}

export async function resetLinkEditors(): Promise<void> {
  const views = mounted.splice(0)
  for (const view of views.slice().reverse()) {
    view.unmount()
  }
  for (const view of views.slice().reverse()) {
    view.api.dispose()
  }
  for (const view of views) {
    await view.api.expectServed()
  }
}

afterEach(resetLinkEditors)
