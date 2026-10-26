import type { Page } from '@playwright/test'
import type { ApiCall, ApiHandler, ApiReply, ApiService } from './http-fixtures'
import type { Acknowledgement, OpenDocument } from '@/contracts/documents'
import {
  EDITOR_WORKSPACE_DOCUMENT_ID,
  editorWorkspaceApi,
  editorWorkspaceDocument,
  paragraphBlock,
} from './editor-workspace-fixtures'
import { editorReady } from './editor-workspace-ui'
import { serveApi } from './http-fixtures'
import { mountSurface } from './mount'

/**
 * The editor chrome boundary: what a header, drawer or dialog case needs from
 * the real editor workspace.
 *
 * The case supplies the draft saves and the publication write, and this table
 * answers them in order, so the header's saved, published and changed states are
 * the ones the client derives from a real acknowledgement chain. These
 * acknowledgements prove client state only: stored revisions, head/live
 * isolation and the public page stay with the E2E cases that call the Worker.
 */
export type ChromeBoundary = {
  /** Handlers the workspace needs, merged into the case's own reply table. */
  readonly writes: Readonly<Record<string, ApiHandler>>
}

/** The write routes this boundary owns, named the way a handler table speaks. */
export const CHROME_ROUTES = {
  revision: 'PUT /api/admin/documents/:id/revisions',
  publish: 'POST /api/admin/documents/:id/publish',
} as const

/** A chrome case document: a fixed title and one paragraph the case works on. */
export function chromeDocument(title: string, body = ''): OpenDocument {
  return editorWorkspaceDocument(title, (document) => {
    document.blocks = [
      paragraphBlock(body),
    ]
  })
}

/**
 * The acknowledged save/publish chain. A save advances the head revision and a
 * publish makes that head live, so a later edit is genuinely `changed` rather
 * than a state a stub asserted.
 */
export function chromeBoundary(document: OpenDocument): ChromeBoundary {
  let ack: Acknowledgement = {
    documentId: document.documentId,
    version: document.version,
    headRevisionId: document.headRevisionId,
    liveRevisionId: document.liveRevisionId,
    liveGeneration: document.liveGeneration,
  }
  return {
    writes: {
      [CHROME_ROUTES.revision]: (call) => {
        ack = {
          ...ack,
          version: expectedVersion(call) + 1,
          headRevisionId: crypto.randomUUID(),
        }
        return { body: ack }
      },
      [CHROME_ROUTES.publish]: (call) => {
        ack = {
          ...ack,
          version: expectedVersion(call) + 1,
          liveRevisionId: ack.headRevisionId,
          liveGeneration: ack.liveGeneration + 1,
        }
        return { body: ack }
      },
    },
  }
}

/** The version the client asked to replace, as both write bodies spell it. */
function expectedVersion(call: ApiCall): number {
  const { json } = call
  if (typeof json === 'object' && json !== null && 'expectedVersion' in json) {
    const value = json.expectedVersion
    return typeof value === 'number' ? value : 0
  }
  return 0
}

/**
 * The verified UTC choices the schedule form offers for one local time. A single
 * choice keeps the picker at the empty entry plus the one offset the original
 * case read, and the offset is the case's own fixed expectation.
 */
export function verifiedScheduleTimes(runAt: number, utcOffset: number): ApiReply {
  return {
    body: {
      choices: [
        { runAt, utcOffset },
      ],
    },
  }
}

/**
 * Mounts the production editor entry at the chrome case's viewport and waits for
 * the loaded body. `serve` adds the reads or writes this case declares; nothing
 * else may reach the surface's client.
 */
export async function openChrome(page: Page, options: {
  document: OpenDocument
  width: number
  height: number
  serve?: Readonly<Record<string, ApiHandler>>
}): Promise<ApiService> {
  const api = await serveApi(page, {
    ...editorWorkspaceApi(options.document),
    ...chromeBoundary(options.document).writes,
    ...options.serve,
  })
  await page.setViewportSize({ width: options.width, height: options.height })
  await mountSurface(page, {
    surface: 'editor-workspace',
    route: `/admin/documents/${EDITOR_WORKSPACE_DOCUMENT_ID}`,
  })
  await editorReady(page)
  return api
}
