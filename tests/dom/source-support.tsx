import type { ApiCall, ApiHandler, ApiService } from './http'
import type { SourceKind } from './source-fixtures'
import type { Document } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import { BlockNoteEditor } from '@blocknote/core'
import { en } from '@blocknote/core/locales'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { validateDocument } from '@/content/document'
import { saveSchema } from '@/contracts/documents'
import { codeSyntaxHighlighting } from '@/features/editor/blocks/code/code-highlighting'
import { nativeBlocks } from '@/features/editor/engine/native'
import { editorSchema } from '@/features/editor/engine/schema'
import { editorWorkspaceSaveAck } from '~/tests/components/support/editor-workspace-fixtures'
import { installBrowserShims, setMediaState } from './environment'
import { serveFetch } from './http'
import { SourceHarness } from './source-harness'

export type { SourceKind } from './source-fixtures'
export {
  codeDocument,
  codeText,
  formulaDocument,
  inlineMathPreviewDocument,
  mathPreviewDocument,
  sourceDocument,
  sourceText,
} from './source-fixtures'

let nextPolicy = 1

export type MountedSourceEditor = {
  readonly initial: OpenDocument
  readonly editor: typeof editorSchema.BlockNoteEditor
  readonly container: HTMLDivElement
  readonly api: ApiService
  unmount: () => void
}

const mounted: MountedSourceEditor[] = []

function createSourceEditor(initial: OpenDocument): typeof editorSchema.BlockNoteEditor {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: nativeBlocks(initial.document),
    extensions: [codeSyntaxHighlighting],
    dictionary: en,
    domAttributes: {
      editor: {
        'aria-label': 'Document body',
      },
    },
  })
}

async function renderSourceHarness(input: {
  root: ReturnType<typeof createRoot>
  container: HTMLElement
  initial: OpenDocument
  editor: typeof editorSchema.BlockNoteEditor
  policy: ReturnType<typeof createPreferencePolicy>
  api: ApiService
}): Promise<void> {
  await act(async () => {
    input.root.render(
      <SourceHarness initial={input.initial} editor={input.editor} policy={input.policy} />,
    )
    await input.api.settle()
  })
  installSourceHostFacts(input.editor, input.container)
}

/**
 * jsdom omits two browser host APIs the real source and diagram views consult.
 * The editable fact is derived from the mounted ProseMirror surface and editor
 * state; the observer never reports an intersection, so diagram rendering stays
 * outside assertions in this layer. A viewport meta tag supplies the documented
 * BlockNote host configuration without measuring or asserting responsive layout.
 */
function installSourceHostFacts(
  editor: typeof editorSchema.BlockNoteEditor,
  container: HTMLElement,
): void {
  const editableRoot = container.querySelector<HTMLElement>('.ProseMirror')
  for (const root of [editor.domElement, editableRoot]) {
    if (root === undefined || root === null) {
      continue
    }
    Object.defineProperty(root, 'isContentEditable', {
      configurable: true,
      get: () => root.closest('[contenteditable="true"]') !== null && editor.isEditable,
    })
  }
  if (typeof window.IntersectionObserver !== 'function') {
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    })
  }
}

export async function mountSourceEditor(
  initial: OpenDocument,
  input: { width?: number, handlers?: Readonly<Record<string, ApiHandler>> } = {},
): Promise<MountedSourceEditor> {
  installBrowserShims()
  setMediaState({ width: input.width ?? 1440, reducedMotion: false, dark: false })
  if (document.head.querySelector('meta[name="viewport"]') === null) {
    const viewport = document.createElement('meta')
    viewport.name = 'viewport'
    viewport.content = 'width=device-width, initial-scale=1, interactive-widget=resizes-content'
    document.head.append(viewport)
  }
  const editor = createSourceEditor(initial)
  const api = serveFetch({
    ...input.handlers,
    'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
  })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const policy = createPreferencePolicy({
    name: `blog.dom.source.${nextPolicy++}.v1`,
    secure: false,
  })
  try {
    await renderSourceHarness({ root, container, initial, editor, policy, api })
  }
  catch (error: unknown) {
    act(() => root.unmount())
    container.remove()
    api.dispose()
    throw error
  }

  let unmounted = false
  const view: MountedSourceEditor = {
    initial,
    editor,
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

export function blockId(view: MountedSourceEditor, type: string): string {
  const block = view.initial.document.blocks.find(item => item.type === type)
  if (block === undefined) {
    throw new Error(`The source fixture has no ${type} block`)
  }
  return block.id
}

export function editorElement(view: MountedSourceEditor): HTMLElement {
  const editor = view.container.querySelector<HTMLElement>('.ProseMirror')
  if (editor === null) {
    throw new Error('The BlockNote editor did not render its editable surface')
  }
  return editor
}

export function sourceField(view: MountedSourceEditor, kind: SourceKind): HTMLElement {
  const field = view.container.querySelector<HTMLElement>(
    `[data-content-type="${kind}"] code[role="textbox"]`,
  )
  if (field === null) {
    throw new Error(`The ${kind} block has no source textbox`)
  }
  return field
}

export function sourceEditButton(view: MountedSourceEditor, kind: SourceKind): HTMLButtonElement {
  const label = kind === 'math' ? 'Edit formula' : 'Edit diagram'
  const button = view.container.querySelector<HTMLButtonElement>(
    `[data-content-type="${kind}"] button[aria-label="${label}"]`,
  )
  if (button === null) {
    throw new Error(`The ${kind} block has no "${label}" control`)
  }
  return button
}

export function revisionWrites(view: MountedSourceEditor): ApiCall[] {
  return view.api.calls.filter(call =>
    call.method === 'PUT' && call.path.endsWith('/revisions'))
}

export async function flushSourceDraft(view: MountedSourceEditor): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new Event('online'))
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    await view.api.expectServed()
  })
}

export function savedDocument(view: MountedSourceEditor): Document {
  const call = revisionWrites(view).at(-1)
  if (call === undefined) {
    throw new Error('The editor sent no revision request')
  }
  return validateDocument(saveSchema.parse(call.json).document)
}

export async function resetSourceEditors(): Promise<void> {
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

afterEach(resetSourceEditors)
