import type { Stub } from './history-page-support'
import type { PageLocale } from './history-state-support'
import type { Document } from '@/content/document'
import type { Draft } from '@/features/editor/draft/persistence'
import type { PreviewModel } from '@/features/editor/preview/preview-model'
import type { DocumentModel, Envelope } from '@/features/editor/workspace/document-model'
import type { HistoryCase } from '~/tests/components/support/history-fixtures'
import { act } from 'react'
import { validateDocument } from '@/content/document'
import { DraftCoordinator } from '@/features/editor/draft/draft'
import { DraftPreviewProvider, LivePreview } from '@/features/editor/preview/live-preview'
import { DocumentActions } from '@/features/editor/workspace/document-actions'
import { historyCase } from '~/tests/components/support/history-fixtures'
import { serveFetch } from './history-page-support'
import { renderElement, visibleText } from './history-state-support'

/**
 * The draft preview entries in jsdom: the copy, the fixtures and the queries the
 * entries case shares.
 *
 * The preview is mounted the way the workspace mounts it and runs the real
 * provider, dialog, reader, notices and translations. What this harness does not
 * have is BlockNote: the editor's `snapshot()` — the one boundary between the
 * live editor and its canonical document — is supplied by the case, so the
 * "unsaved draft" is exactly the document that boundary returns.
 */

/** The copy an author reads, held here as the accepted wording rather than imported from the product. */
export const previewCopy = {
  'en': {
    entry: 'Preview',
    more: 'More document actions',
    dialog: 'Draft preview',
    reader: 'Draft reader preview',
    close: 'Close preview',
    savedRevision: 'Preview saved revision',
    catalog: 'Tags and series',
    recovery: 'Local recovery copy',
    recoveryDescription: 'Your local copy differs from this saved revision.',
    saved: 'Saved',
    recover: 'Open recovered draft',
    dismiss: 'Dismiss',
  },
  'zh-CN': {
    entry: '预览',
    more: '更多文档操作',
    dialog: '草稿预览',
    reader: '草稿阅读预览',
    close: '关闭预览',
    savedRevision: '预览已保存修订',
    catalog: '标签与系列',
    recovery: '本地恢复副本',
    recoveryDescription: '本机副本与当前已保存修订不同。',
    saved: '已保存',
    recover: '打开恢复的草稿',
    dismiss: '忽略',
  },
} as const

export const savedText = 'The saved paragraph before editing'
export const unsavedText = 'The current unsaved paragraph, including 当前未保存的内容'
export const reopenedText = 'The draft paragraph after the second edit'
export const recoveryText = 'A local recovery copy that was never sent to the server'

/** The instant the stored local copy reports; fixed so its label is checkable. */
export const recoverySavedAt = Date.UTC(2026, 0, 2, 9, 4)

/** The same document with one paragraph rewritten in place, re-validated by the product schema. */
export function draftDocument(document: Document, text: string): Document {
  const draft = structuredClone(document)
  const block = draft.blocks[0]
  if (block === undefined) {
    throw new TypeError('The history fixture has no paragraph')
  }
  block.content = [
    { type: 'text', text, styles: {} },
  ]
  return validateDocument(draft)
}

/** The value, or a thrown error naming what the surface did not render. */
export function required<T>(value: T | null | undefined, description: string): T {
  if (value === null || value === undefined) {
    throw new TypeError(`No ${description}`)
  }
  return value
}

/** Every field of a document except the body the editor snapshots. */
function envelopeOf(document: Document): Envelope {
  const { blocks, ...fields } = document
  return fields
}

/** An element's accessible name as the DOM exposes it. */
export function accessibleName(element: Element): string {
  const label = element.getAttribute('aria-label')
  if (label !== null) {
    return label
  }
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy !== null) {
    return labelledBy.split(/\s+/)
      .map(id => visibleText(document.getElementById(id)))
      .join(' ')
      .trim()
  }
  return visibleText(element)
}

/** Every element carrying `role`, optionally restricted to one accessible name. */
export function elementsByRole(role: string, name?: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(`[role="${role}"]`))
    .filter((item): item is HTMLElement => item instanceof HTMLElement)
    .filter(item => name === undefined || accessibleName(item) === name)
}

/** The one element carrying `role`, or null when the surface is closed. */
export function elementByRole(role: string, name?: string): HTMLElement | null {
  const found = elementsByRole(role, name)
  if (found.length > 1) {
    throw new Error(`Expected one ${role}${name === undefined ? '' : ` named ${name}`}, found ${String(found.length)}`)
  }
  return found[0] ?? null
}

/** Every button, menu item or link within `root` carrying `name` as its accessible name. */
export function controlsWithin(root: ParentNode, name: string): HTMLElement[] {
  return Array.from(root.querySelectorAll('button, [role="menuitem"], a[href]'))
    .filter((item): item is HTMLElement => item instanceof HTMLElement)
    .filter(item => accessibleName(item) === name)
}

/** A button or menu item by its accessible name, or null when it is not rendered. */
export function controlNamed(name: string): HTMLElement | null {
  return controlsWithin(document, name)[0] ?? null
}

/** The preview dialog the provider owns, once one is open. */
export function previewDialog(name: string): HTMLElement | null {
  return elementByRole('dialog', name)
}

/** The reader region inside the open preview dialog. */
export function previewReader(dialog: HTMLElement, name: string): HTMLElement | null {
  return Array.from(dialog.querySelectorAll('[role="region"]'))
    .filter((item): item is HTMLElement => item instanceof HTMLElement)
    .find(item => accessibleName(item) === name) ?? null
}

/** Answers the layout queries the surfaces read. */
export function installLayoutQueries(compact: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: compact && query === '(max-width: 700px)',
      media: query,
      onchange: null,
      addEventListener: (): void => { /* no media changes in jsdom */ },
      removeEventListener: (): void => { /* no media changes in jsdom */ },
      addListener: (): void => { /* no media changes in jsdom */ },
      removeListener: (): void => { /* no media changes in jsdom */ },
      dispatchEvent: (): boolean => false,
    }),
  })
}

/** Runs React commits until `condition` holds, within a bounded number of turns. */
async function settle(condition: () => boolean, description: string): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) {
    if (condition()) {
      return
    }
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
    })
  }
  if (!condition()) {
    const region = document.querySelector('[role="region"]')
    throw new Error(`The DOM never rendered ${description}: ${visibleText(region).slice(0, 200)}`)
  }
}

export { settle }

/**
 * Mutations and callbacks the preview paths attempted. A throwing `send` alone
 * could be swallowed by the product and leave no request behind, so each attempt
 * is recorded and the case asserts the list is empty when it tears down.
 */
const mutationAttempts: string[] = []

export function unexpectedMutationAttempts(): readonly string[] {
  return mutationAttempts
}

/** Records a callback the mounted surface must not invoke for this case. */
export function recordUnexpected(attempt: string): void {
  mutationAttempts.push(attempt)
}

/** A rejection that records the mutation a preview surface must never attempt. */
function previewOnly(action: string): () => Promise<never> {
  return async () => {
    mutationAttempts.push(action)
    return await Promise.reject(new Error(`Previewing the draft must not ${action}`))
  }
}

/** The workspace's live fields the preview entries read, around the case's snapshot boundary. */
type PreviewHarness = {
  readonly workspace: {
    readonly model: PreviewModel & Pick<DocumentModel, 'uploading'>
    readonly draft: Pick<Draft, 'ack' | 'status' | 'coordinator'>
    readonly busy: boolean
    readonly run: (task: Promise<unknown>) => void
  }
  /** The actions a case expected the menu to run; previewing must leave it empty. */
  readonly flights: Promise<unknown>[]
  readonly snapshots: () => number
  readonly edit: (text: string) => void
}

export function previewHarness(fixture: HistoryCase): PreviewHarness {
  let draft = draftDocument(fixture.initial.document, unsavedText)
  let snapshots = 0
  const snapshot = async (): Promise<Document> => {
    snapshots += 1
    return await Promise.resolve(structuredClone(draft))
  }
  const editor: PreviewModel['editor'] = {
    onChange: () => () => {},
    focus: () => {},
  }
  const model: PreviewModel & Pick<DocumentModel, 'uploading'> = {
    editor,
    snapshot,
    composingRef: { current: false },
    envelope: envelopeOf(fixture.initial.document),
    uploading: false,
  }
  const flights: Promise<unknown>[] = []
  const coordinator = new DraftCoordinator(
    fixture.initial,
    snapshot,
    async () => {
      mutationAttempts.push('save')
      return await Promise.reject(new Error('Previewing the draft must not save it'))
    },
    () => {},
  )
  return {
    workspace: {
      model,
      draft: {
        ack: coordinator.acknowledgement,
        status: 'saved',
        coordinator,
      },
      busy: false,
      run: (task: Promise<unknown>) => {
        flights.push(task)
      },
    },
    flights,
    snapshots: () => snapshots,
    edit: (text) => {
      draft = draftDocument(fixture.initial.document, text)
    },
  }
}

/** The two preview entries over one provider, with the editor snapshot boundary supplied by the case. */
export async function mountPreviewEntries(
  locale: PageLocale,
  layout: 'compact' | 'wide' = 'wide',
): Promise<{
  readonly stub: Stub
  readonly flights: Promise<unknown>[]
  readonly snapshots: () => number
  readonly edit: (text: string) => void
}> {
  // The compact branch is the product's own Drawer; the query the panel reads decides it.
  installLayoutQueries(layout === 'compact')
  // Load the reader chunk once, so the real lazy reader resolves on the next commit.
  await import('@/features/reader/document')
  const harness = previewHarness(historyCase({ body: savedText, latestBody: savedText }))
  const stub = serveFetch({})
  renderElement(
    <DraftPreviewProvider workspace={harness.workspace}>
      <LivePreview />
      <DocumentActions
        workspace={harness.workspace}
        publish={previewOnly('publish')}
        remove={previewOnly('delete')}
        livePath={null}
      />
    </DraftPreviewProvider>,
    locale,
  )
  return { stub, ...harness }
}
