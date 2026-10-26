/* eslint-disable react-refresh/only-export-components -- DOM harness, not a Fast Refresh boundary. */
/* eslint-disable max-lines -- Keep the local editor boundary and its cleanup together. */
import type { RefObject } from 'react'
import type { Locale, PreferencePolicy } from '@/components/ui/ztd-me'
import type { Document } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import type { Draft } from '@/features/editor/draft/persistence'
import type { DocumentModel, Envelope } from '@/features/editor/workspace/document-model'
import { BlockNoteEditor } from '@blocknote/core'
import { en, zh } from '@blocknote/core/locales'
import { BlockNoteViewRaw, ComponentsContext } from '@blocknote/react'
import { act, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { validateDocument } from '@/content/document'
import { editorComponents } from '@/features/editor/adapters/components'
import { EditorFormattingControls } from '@/features/editor/controls/formatting/formatting-controls'
import { useDraft } from '@/features/editor/draft/persistence'
import { documentAccessibility } from '@/features/editor/engine/document-accessibility'
import { nativeBlocks, nodes } from '@/features/editor/engine/native'
import { editorSchema as schema } from '@/features/editor/engine/schema'
import { BlogFrontend } from '@/i18n/frontend'
import { COMPONENT_TEST_FIXTURES } from '~/tests/components/src/fixtures'
import {
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
  paragraphBlock,
} from '~/tests/components/support/editor-workspace-fixtures'
import { drainHostTask, installBrowserShims, setMediaState } from './environment'
import { serveFetch } from './http'

const owner = COMPONENT_TEST_FIXTURES.owner
const csrfToken = COMPONENT_TEST_FIXTURES.csrfToken
let nextPolicy = 1

/**
 * jsdom has no Range geometry. Floating toolbar mounting asks the browser for a
 * rect, so this host shim supplies an empty rect only; no test asserts placement.
 */
function installRangeGeometryHost(): void {
  if (typeof Reflect.get(Range.prototype, 'getClientRects') !== 'function') {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [],
    })
  }
  if (typeof Reflect.get(Range.prototype, 'getBoundingClientRect') !== 'function') {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(),
    })
  }
}

function installViewportMeta(): void {
  if (document.head.querySelector('meta[name="viewport"]') !== null) {
    return
  }
  const viewport = document.createElement('meta')
  viewport.name = 'viewport'
  viewport.content = 'width=device-width, initial-scale=1, interactive-widget=resizes-content'
  document.head.append(viewport)
}

type FormatProbe = {
  readonly model: DocumentModel
  readonly draft: Draft
  readonly disabled: boolean
  readonly setDisabled: (disabled: boolean) => void
}

export type MountedFormatting = {
  readonly initial: OpenDocument
  readonly editor: typeof schema.BlockNoteEditor
  readonly container: HTMLDivElement
  readonly api: ReturnType<typeof serveFetch>
  readonly state: () => FormatProbe
  readonly flush: () => Promise<void>
  unmount: () => void
}

const mounted: MountedFormatting[] = []

function preferences(locale: Locale): { version: 1, mode: 'light', palette: 'neutral', locale: Locale } {
  return { version: 1, mode: 'light', palette: 'neutral', locale }
}

function documentEnvelope(document: Document): Envelope {
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

function documentModel(
  initial: OpenDocument,
  editor: typeof schema.BlockNoteEditor,
  locale: Locale,
  composingRef: RefObject<boolean>,
): DocumentModel {
  const envelope = documentEnvelope(initial.document)
  return {
    editor,
    envelope,
    nodeItems: nodes(initial.document),
    snapshot: async () => await Promise.resolve(validateDocument({
      ...envelope,
      blocks: editor.document,
      ...documentAccessibility(initial.document, editor.document),
    })),
    composingRef,
    editorLocale: locale,
    pasteNotice: '',
    uploadFiles: async () => await Promise.resolve(''),
    uploading: false,
    hasUploads: () => false,
    waitUploads: async () => await Promise.resolve(),
    pastePlain: null,
    updateFields: () => {},
  }
}

function FormattingSurface({
  initial,
  editor,
  locale,
  composingRef,
  onProbe,
  policy,
}: {
  initial: OpenDocument
  editor: typeof schema.BlockNoteEditor
  locale: Locale
  composingRef: RefObject<boolean>
  onProbe: (probe: FormatProbe) => void
  policy: PreferencePolicy
}): React.JSX.Element {
  const model = useMemo(
    () => documentModel(initial, editor, locale, composingRef),
    [
      initial,
      editor,
      locale,
      composingRef,
    ],
  )
  const draft = useDraft({ initial, owner, csrfToken, model, recovered: false })
  const [disabled, setDisabled] = useState(false)
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null)
  onProbe({ model, draft, disabled, setDisabled })

  return (
    <BlogFrontend initialPreferences={preferences(locale)} policy={policy}>
      <ComponentsContext value={editorComponents}>
        <BlockNoteViewRaw
          editor={editor}
          editable={!disabled}
          comments={false}
          emojiPicker={false}
          slashMenu={false}
          sideMenu={false}
          filePanel={false}
          formattingToolbar={false}
          linkToolbar={false}
          tableHandles={false}
          portalElements={{ default: overlay ?? undefined }}
        >
          <EditorFormattingControls
            disabled={disabled}
            composingRef={composingRef}
            portalElement={overlay}
          />
        </BlockNoteViewRaw>
      </ComponentsContext>
      <div ref={setOverlay} className="editor-overlays" />
    </BlogFrontend>
  )
}

function createEditor(initial: OpenDocument, locale: Locale): typeof schema.BlockNoteEditor {
  return BlockNoteEditor.create({
    schema,
    initialContent: nativeBlocks(initial.document),
    dictionary: locale === 'zh-CN' ? zh : en,
    domAttributes: {
      editor: {
        'aria-label': locale === 'zh-CN' ? '正文' : 'Document body',
      },
    },
  })
}

function renderFormattingSurface(input: {
  initial: OpenDocument
  editor: typeof schema.BlockNoteEditor
  locale: Locale
  composingRef: RefObject<boolean>
  onProbe: (probe: FormatProbe) => void
}): { container: HTMLDivElement, root: ReturnType<typeof createRoot> } {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const policy = createPreferencePolicy({
    name: `blog.dom.formatting.${nextPolicy++}.v1`,
    secure: false,
  })
  act(() => {
    root.render(
      <FormattingSurface
        initial={input.initial}
        editor={input.editor}
        locale={input.locale}
        composingRef={input.composingRef}
        policy={policy}
        onProbe={input.onProbe}
      />,
    )
  })
  return { container, root }
}

function mountedView(input: {
  initial: OpenDocument
  editor: typeof schema.BlockNoteEditor
  api: ReturnType<typeof serveFetch>
  container: HTMLDivElement
  root: ReturnType<typeof createRoot>
  probe: () => FormatProbe | null
}): MountedFormatting {
  let unmounted = false
  const view: MountedFormatting = {
    initial: input.initial,
    editor: input.editor,
    container: input.container,
    api: input.api,
    state: () => {
      const latest = input.probe()
      if (latest === null) {
        throw new Error('The formatting surface never rendered')
      }
      return latest
    },
    flush: async () => {
      await act(async () => {
        await view.state().draft.coordinator.flush()
      })
      await input.api.expectServed()
    },
    unmount: () => {
      if (unmounted) {
        return
      }
      unmounted = true
      act(() => {
        input.root.unmount()
      })
      input.container.remove()
    },
  }
  return view
}

/** Mounts the real BlockNote editor, formatting controls, draft hook and HTTP client. */
export function mountFormattingEditor(input: {
  blocks?: Document['blocks']
  locale?: Locale
  width?: number
} = {}): MountedFormatting {
  installBrowserShims()
  installRangeGeometryHost()
  installViewportMeta()
  setMediaState({ width: input.width ?? 1440, reducedMotion: false, dark: false })
  const locale = input.locale ?? 'en'
  const initial = editorWorkspaceDocument('Formatting interaction', (document) => {
    document.blocks = input.blocks ?? [
      paragraphBlock('Selected phrase untouched suffix'),
    ]
  })
  const editor = createEditor(initial, locale)
  const api = serveFetch({
    'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
  })
  const composingRef = { current: false }
  let latest: FormatProbe | null = null
  const { container, root } = renderFormattingSurface({
    initial,
    editor,
    locale,
    composingRef,
    onProbe: (probe) => {
      latest = probe
    },
  })
  const view = mountedView({
    initial,
    editor,
    api,
    container,
    root,
    probe: () => latest,
  })
  mounted.push(view)
  return view
}

/** Applies a text-range selection through the real ProseMirror editor state. */
export async function selectFormatRange(
  view: MountedFormatting,
  start: number,
  end: number,
  blockIndex = 0,
): Promise<void> {
  const state = view.editor._tiptapEditor.state
  const block = view.editor.document[blockIndex]
  if (block === undefined || !Array.isArray(block.content)) {
    throw new Error(`The formatting document has no text block at ${blockIndex}`)
  }
  const blockText = block.content.map(inline => 'text' in inline ? inline.text : '').join('')
  let textStart = -1
  state.doc.descendants((node, position) => {
    if (textStart < 0 && node.isText && node.text === blockText) {
      textStart = position
    }
  })
  if (textStart < 0) {
    throw new Error(`The formatting text block was not found at ${blockIndex}`)
  }
  act(() => {
    view.editor._tiptapEditor.commands.setTextSelection({
      from: textStart + start,
      to: textStart + end,
    })
  })
  await drainHostTask()
  if (selectedFormatText(view) !== blockText.slice(start, end)) {
    throw new Error('The BlockNote editor rejected the formatting range')
  }
}

export function selectedFormatText(view: MountedFormatting): string {
  const { from, to } = view.editor._tiptapEditor.state.selection
  return view.editor._tiptapEditor.state.doc.textBetween(from, to)
}

export async function resetFormattingEditors(): Promise<void> {
  const views = mounted.splice(0)
  for (const view of views.slice().reverse()) {
    view.unmount()
    await drainHostTask()
  }
  for (const view of views.slice().reverse()) {
    view.api.dispose()
  }
  for (const view of views) {
    await view.api.expectServed()
  }
}

afterEach(resetFormattingEditors)
