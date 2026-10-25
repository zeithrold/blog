import type { Locator, Page } from '@playwright/test'
import type { ApiCall, ApiHandler, ApiService } from './http-fixtures'
import type { Document } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import { expect } from '@playwright/test'
import { z } from 'zod'
import {
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceApi,
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
  paragraphBlock,
} from './editor-workspace-fixtures'
import { serveApi } from './http-fixtures'
import { mountSurface } from './mount'

export type SourceKind = 'math' | 'mermaid'
export const sourceText: Record<SourceKind, string> = { math: 'x=1', mermaid: 'graph TD\nA-->B' }

const keptParagraph = 'Keep this paragraph'

function sourceBlock(kind: SourceKind): Document['blocks'][number] {
  const props: Record<string, string | number | boolean> = kind === 'mermaid'
    ? { description: 'A diagram' }
    : {}
  return {
    id: crypto.randomUUID(),
    type: kind,
    props,
    content: [
      { type: 'text', text: sourceText[kind], styles: {} },
    ],
    children: [],
  }
}

/**
 * The document a source case opens: a source block with a neighbouring paragraph, in the
 * arrangement the case needs. The block shapes are the ones an author's document holds, so the
 * editor reads them through its real schema instead of a stand-in.
 */
function placeSource(
  document: Document,
  kind: SourceKind,
  layout: 'before' | 'lone' | 'around',
): void {
  const keep = paragraphBlock(keptParagraph)
  if (layout === 'lone') {
    document.blocks = [
      sourceBlock(kind),
    ]
  }
  else if (layout === 'before') {
    document.blocks = [
      sourceBlock(kind),
      keep,
    ]
  }
  else {
    document.blocks = [
      keep,
      sourceBlock(kind),
      paragraphBlock('After source'),
    ]
  }
}

/** The reads the mounted workspace performs plus the revision write the draft coordinator sends. */
export function editorSourceApi(open: OpenDocument): Record<string, ApiHandler> {
  return {
    ...editorWorkspaceApi(open),
    'PUT /api/admin/documents/:id/revisions': editorWorkspaceSaveAck,
  }
}

export type SourceWorkspace = { readonly api: ApiService, readonly body: Locator }

/** Mounts the production editor entry on the source document this case owns. */
export async function openSourceWorkspace(
  page: Page,
  kind: SourceKind,
  layout: 'before' | 'lone' | 'around' = 'before',
  handlers?: (open: OpenDocument) => Record<string, ApiHandler>,
): Promise<SourceWorkspace> {
  const open = editorWorkspaceDocument('Source interaction', (document) => {
    placeSource(document, kind, layout)
  })
  const api = await serveApi(page, { ...editorSourceApi(open), ...handlers?.(open) })
  await mountSurface(page, {
    surface: 'editor-workspace',
    route: `/admin/documents/${EDITOR_WORKSPACE_DOCUMENT_ID}`,
  })
  const body = page.getByLabel('Document body', { exact: true })
  await expect(body).toBeVisible()
  return { api, body }
}

/** Selects a source block natively: a collapsed caret before the paragraph, then Backspace. */
export async function selectSourceBlock(page: Page, body: Locator): Promise<void> {
  await body.locator('[data-content-type="paragraph"] .bn-inline-content').evaluate((element) => {
    const editor = element.closest<HTMLElement>('[contenteditable="true"]')
    editor?.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(true)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  await page.keyboard.press('Backspace')
  await expect(body.locator('.ProseMirror-selectednode').first()).toBeVisible()
}

/** The revision packet's document, as far as a source case reads it. */
const revisionPacketSchema = z.object({
  document: z.object({
    blocks: z.array(z.object({
      type: z.string(),
      content: z.array(z.object({ text: z.string().optional() })),
    })),
  }),
})

function sourceTextOf(body: unknown, kind: SourceKind): string | undefined {
  const parsed = revisionPacketSchema.safeParse(body)
  if (!parsed.success) {
    return undefined
  }
  const block = parsed.data.document.blocks.find(item => item.type === kind)
  return block?.content.map(part => part.text ?? '').join('')
}

/**
 * The source text of the last revision packet the editor sent. A save is answered by the case's
 * own handler, so this asserts what the client handed to the API rather than imitating storage.
 */
export async function expectSavedSource(
  api: ApiService,
  kind: SourceKind,
  value: string,
): Promise<void> {
  await expect.poll(() => {
    const writes: ApiCall[] = api.calls.filter(call => call.method === 'PUT')
    return sourceTextOf(writes.at(-1)?.json, kind)
  }, { timeout: 15000 }).toBe(value)
}
