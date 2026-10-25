import type { ApiCall, ApiHandler, ApiReply } from './http-fixtures'
import type { Block, Document } from '@/content/document'
import type { OpenDocument } from '@/contracts/documents'
import { emptyDocument } from '@/content/document'
import { openDocumentSchema } from '@/contracts/documents'
import { COMPONENT_TEST_FIXTURES } from '../src/fixtures'

/**
 * The editor workspace surface mounts the production editor entry, which runs
 * its own session and document load, so a case supplies those replies here.
 *
 * Identifiers are fixed instead of generated: every case gets a fresh browser
 * context, and a fixed row keeps both the request path and the rendered
 * document readable in a handler table.
 */
export const EDITOR_WORKSPACE_DOCUMENT_ID = '3f0b5f0e-6f0e-4a6c-9b7e-5c2ad6b1f0a1'
const headRevisionId = '8a1d2c34-5b6e-4f70-8c91-2d3e4f5a6b7c'

/**
 * The saved document a case opens: a real schema-valid article envelope, so
 * the editor reads the same shapes the Worker returns instead of a stand-in.
 * `configure` builds the document body a case needs before the envelope is
 * validated, so an invalid fixture fails here rather than in the surface.
 */
export function editorWorkspaceDocument(
  title = 'Editor workspace document',
  configure?: (document: Document) => void,
): OpenDocument {
  const document = emptyDocument()
  document.meta.title = title
  document.meta.slug = 'editor-workspace-document'
  configure?.(document)
  return openDocumentSchema.parse({
    documentId: EDITOR_WORKSPACE_DOCUMENT_ID,
    version: 0,
    headRevisionId,
    liveRevisionId: null,
    liveGeneration: 0,
    kind: 'article',
    livePath: null,
    document,
  })
}

export function paragraphBlock(text = ''): Block {
  return {
    id: crypto.randomUUID(),
    type: 'paragraph',
    props: { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' },
    content: text === ''
      ? []
      : [
          { type: 'text', text, styles: {} },
        ],
    children: [],
  }
}

/** Filler body text: enough blocks for a locate target to be off screen. */
export function paragraphBlocks(count: number): Block[] {
  return Array.from({ length: count }, (_block, index) =>
    paragraphBlock(`Body paragraph ${String(index + 1).padStart(2, '0')}`))
}

/** A code block in the language the case selects. */
export function codeBlock(source: string, language = 'text'): Block {
  return {
    id: crypto.randomUUID(),
    type: 'codeBlock',
    props: { language },
    content: [
      { type: 'text', text: source, styles: {} },
    ],
    children: [],
  }
}

/** Diagram source the editor cannot render, so preflight reports it. */
export function mermaidBlock(source: string): Block {
  return {
    id: crypto.randomUUID(),
    type: 'mermaid',
    props: { description: '' },
    content: [
      { type: 'text', text: source, styles: {} },
    ],
    children: [],
  }
}

/** A media block with no file chosen yet. */
export function emptyFileBlock(id = crypto.randomUUID()): Block {
  return {
    id,
    type: 'file',
    props: { url: '', name: '', caption: '', backgroundColor: 'default' },
    children: [],
  }
}

export function calloutBlock(children: Block[]): Block {
  return {
    id: crypto.randomUUID(),
    type: 'callout',
    props: { tone: 'info' },
    content: [],
    children,
  }
}

/** A table whose first cell reads `First cell`, the cell a locate case uses. */
export function tableBlock(rows = 2, columns = 2): Block {
  return {
    id: crypto.randomUUID(),
    type: 'table',
    props: { textColor: 'default' },
    content: {
      type: 'tableContent',
      columnWidths: Array.from<number>({ length: columns }).fill(120),
      rows: Array.from({ length: rows }, (_row, row) => ({
        cells: Array.from({ length: columns }, (_cell, column) => [
          {
            type: 'text' as const,
            text: row === 0 && column === 0 ? 'First cell' : `Row ${row + 1}, column ${column + 1}`,
            styles: {},
          },
        ]),
      })),
    },
    children: [],
  }
}

/** Records a media block that still needs its accessible description. */
export function registerEmptyMedia(document: Document, blockId: string): void {
  document.mediaAccessibility[blockId] = {
    alt: '',
    decorative: false,
    transcript: '',
    captionAssetId: null,
    posterAssetId: null,
  }
}

/**
 * The reply a declared revision write receives. It carries the shape the client
 * parses, and nothing here claims the edit was stored: a case asserts the
 * request it captured, and persistence stays with the E2E cases that own it.
 */
export function editorWorkspaceSaveAck(call: ApiCall): ApiReply {
  return {
    body: {
      documentId: EDITOR_WORKSPACE_DOCUMENT_ID,
      version: expectedVersion(call.json) + 1,
      headRevisionId: crypto.randomUUID(),
      liveRevisionId: null,
      liveGeneration: 0,
      unchanged: false,
    },
  }
}

/** The version the client asked to replace, as the request body spells it. */
function expectedVersion(json: unknown): number {
  if (typeof json === 'object' && json !== null && 'expectedVersion' in json) {
    const value = json.expectedVersion
    return typeof value === 'number' ? value : 0
  }
  return 0
}

/**
 * The reads the mounted workspace performs. Each entry is an explicit reply for
 * one known route; a request no case described is answered with a problem
 * response and reported by `expectServed()`, so an added read fails the case
 * instead of silently rendering whatever the static server returned.
 */
export function editorWorkspaceApi(open: OpenDocument): Record<string, ApiHandler> {
  return {
    'GET /api/admin/session': () => ({
      body: {
        csrfToken: COMPONENT_TEST_FIXTURES.csrfToken,
        ownerSub: COMPONENT_TEST_FIXTURES.owner,
      },
    }),
    'GET /api/admin/documents/:id': () => ({ body: open }),
    'GET /api/admin/documents/:id/schedule': () => ({ body: { items: [] } }),
    'GET /api/admin/catalog/tag': () => ({ body: { items: [] } }),
    'GET /api/admin/catalog/series': () => ({ body: { items: [] } }),
  }
}

/** Writes the surface attempted, so a case can assert it saved nothing. */
export function editorWorkspaceWrites(calls: readonly ApiCall[]): ApiCall[] {
  return calls.filter(call => call.method !== 'GET')
}
