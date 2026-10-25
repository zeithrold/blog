import type { Page } from '@playwright/test'
import type { ApiHandler } from './http-fixtures'
import type { Acknowledgement, OpenDocument } from '@/contracts/documents'
import { expect } from '@playwright/test'
import {
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceApi,
  editorWorkspaceDocument,
} from './editor-workspace-fixtures'
import { serveApi } from './http-fixtures'
import { mountSurface } from './mount'

/**
 * The workspace route a case mounts on, and the write boundary it acknowledges.
 *
 * The editor entry reads its document over HTTP, so a case owns the replies: a
 * draft save and a publication are acknowledged here with the schema the client
 * parses, and nothing is stored. D1 persistence stays with the representative
 * E2E cases that call the real API.
 */
export const EDITOR_WORKSPACE_ROUTE = `/admin/documents/${EDITOR_WORKSPACE_DOCUMENT_ID}`

const seeded = editorWorkspaceDocument()

/** The stored acknowledgement a save or publish answers with. */
export function acknowledged(overrides: Partial<Acknowledgement> = {}): Acknowledgement {
  return {
    documentId: seeded.documentId,
    version: 1,
    headRevisionId: seeded.headRevisionId,
    liveRevisionId: null,
    liveGeneration: 0,
    ...overrides,
  }
}

/** The acknowledgement a publish returns: the head revision is now live. */
export function publicationAck(): Acknowledgement {
  return acknowledged({ liveRevisionId: seeded.headRevisionId, liveGeneration: 1 })
}

export async function serveWorkspace(
  page: Page,
  open: OpenDocument,
  writes: Readonly<Record<string, ApiHandler>> = {},
): Promise<ReturnType<typeof serveApi>> {
  return await serveApi(page, {
    ...editorWorkspaceApi(open),
    'PUT /api/admin/documents/:id/revisions': () => ({ body: acknowledged() }),
    ...writes,
  })
}

/**
 * Mounts the workspace and waits for the loaded document. The entry only names
 * the document to open, so the title from the reply proves the real load ran and
 * the editor is interactive before a case touches its chrome.
 */
export async function openWorkspace(page: Page, options: {
  title: string
  width: number
  height?: number
}): Promise<void> {
  await page.setViewportSize({ width: options.width, height: options.height ?? 900 })
  await mountSurface(page, { surface: 'editor-workspace', route: EDITOR_WORKSPACE_ROUTE })
  await expect(page.locator('.title-field input')).toHaveValue(options.title)
}
