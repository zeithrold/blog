import type { Page } from '@playwright/test'
import type { ApiCall, ApiHandler, ApiService } from './http-fixtures'
import type { Document, Table } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import { expect } from '@playwright/test'
import { envelope } from '@/content/envelope'
import { table as tableContent } from '@/content/table-schema'
import { editorWorkspaceDocument, editorWorkspaceSaveAck } from './editor-workspace-fixtures'
import { editorReady, mountEditorWorkspace } from './editor-workspace-ui'
import { apiKey } from './http-fixtures'

/**
 * The one write a table case declares: the editor's revision save. The handler
 * acknowledges the version the request names and stores nothing. A case reads
 * the request it captured; D1 persistence and canonicalization stay with the
 * Worker tests and the retained save/reload E2E cases.
 */
export const tableSaveWrites: Readonly<Record<string, ApiHandler>> = {
  'PUT /api/admin/documents/:id/revisions': call => editorWorkspaceSaveAck(call),
}

/**
 * Opens the workspace on a body built by the native table fixtures. Only the
 * body and its captions travel from the fixture; the envelope keeps the fixed
 * identifiers and revision the workspace route names.
 */
export function editorTableDocument(body: Document, title = 'Table editing'): OpenDocument {
  return editorWorkspaceDocument(title, (document) => {
    document.blocks = structuredClone(body.blocks)
    document.tableAccessibility = structuredClone(body.tableAccessibility)
  })
}

function revisionCalls(api: ApiService): ApiCall[] {
  return api.calls.filter(call => apiKey(call.method, call.path) === 'PUT /api/admin/documents/:id/revisions')
}

/** The revision saves attempted so far, so a case can name the one it awaits. */
export function revisionCount(api: ApiService): number {
  return revisionCalls(api).length
}

/**
 * Flushes the pending draft the way a restored connection does. Autosave would
 * reach the same coordinator flush after its idle timer; triggering it keeps a
 * case about the edit rather than the delay. A failed flush still falls through
 * to the native autosave, so the assertion never depends on this trigger.
 */
export async function flushDraft(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}

/**
 * The body the latest acknowledged revision carries. This is the outgoing
 * packet, not a stored document: the case asserts what the editor sent instead
 * of reading a Worker snapshot no component test owns.
 */
export async function savedDocument(page: Page, api: ApiService, before: number): Promise<Document> {
  await flushDraft(page)
  await expect.poll(() => revisionCount(api), { timeout: 15000 }).toBeGreaterThan(before)
  await expect(page.locator('.save-status')).toHaveAttribute('data-status', 'saved')
  await expect(page.getByRole('alert')).toHaveCount(0)
  const call = revisionCalls(api).at(-1)
  if (call === undefined || typeof call.json !== 'object' || call.json === null
    || !('document' in call.json)) {
    throw new Error('The saved revision carries no document body')
  }
  return envelope.parse(call.json.document)
}

export function tablesOf(document: Document): Table[] {
  return document.blocks.flatMap((block): Table[] => {
    if (block.type !== 'table') {
      return []
    }
    const content: unknown = block.content
    return [
      tableContent.parse(content),
    ]
  })
}

export function tableAt(document: Document, index = 0): Table {
  const table = tablesOf(document)[index]
  if (table === undefined) {
    throw new Error(`The saved revision has no table at index ${index}`)
  }
  return table
}

/** Finds the table a case edited by the block id it built the fixture with. */
export function tableOfId(document: Document, id: string): Table {
  const block = document.blocks.find(entry => entry.id === id)
  if (block?.type !== 'table') {
    throw new Error(`The saved revision has no table block ${id}`)
  }
  const content: unknown = block.content
  return tableContent.parse(content)
}

/** Waits for the save a case just triggered and returns the table it wrote. */
export async function savedTable(
  page: Page,
  api: ApiService,
  before: number,
  index = 0,
): Promise<Table> {
  return tableAt(await savedDocument(page, api, before), index)
}

/**
 * Mounts the workspace on a native table body at one viewport, with the one
 * declared revision write. The case captures what that write carried.
 */
export async function mountTableWorkspace(
  page: Page,
  body: Document,
  width = 1440,
  locale: 'en' | 'zh' = 'en',
): Promise<{ api: ApiService, open: Document }> {
  return await mountTableWorkspaceWithWrites(page, body, { width, locale })
}

/**
 * Same mount, plus the writes a case declares beside its revision save. A
 * refused or held write is answered by the case's handler; nothing here claims
 * the Worker performed it.
 */
export async function mountTableWorkspaceWithWrites(
  page: Page,
  body: Document,
  options: {
    width?: number
    locale?: 'en' | 'zh'
    writes?: Readonly<Record<string, ApiHandler>>
  } = {},
): Promise<{ api: ApiService, open: Document }> {
  const document = editorTableDocument(body)
  const api = await mountEditorWorkspace(page, {
    document,
    width: options.width ?? 1440,
    locale: options.locale ?? 'en',
    writes: {
      ...tableSaveWrites,
      ...options.writes,
    },
  })
  await editorReady(page, options.locale ?? 'en')
  return { api, open: document.document }
}

/** The toolbar Undo is a native transaction; the next revision carries it. */
export async function undoRevision(
  page: Page,
  api: ApiService,
  index = 0,
): Promise<Table> {
  const before = revisionCount(api)
  await page.getByRole('toolbar', { name: 'Editor actions', exact: true })
    .getByRole('button', { name: 'Undo', exact: true })
    .click()
  return await savedTable(page, api, before, index)
}
