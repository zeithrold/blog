import type { ApiCall, ApiHandler } from './http-fixtures'
import type { Document } from '@/content/document'
import type { ReferenceMetadata } from '@/content/reference-metadata'
import type { OpenDocument } from '@/contracts/documents'
import { validateDocument } from '@/content/document'
import {
  editorWorkspaceDocument,
  editorWorkspaceSaveAck,
  tableBlock,
} from './editor-workspace-fixtures'

/**
 * The stored shapes the reference settings render.
 *
 * A reference is only special because the document body cites it, so the cited
 * fixture carries both: the row the list must protect from removal and the
 * citation that makes it cited. Everything here is a schema-valid document, the
 * same envelope the Worker returns.
 */
export function citedReference(): Document['references'][number] {
  return {
    id: crypto.randomUUID(),
    title: 'Attention Is All You Need',
    authors: ['Ashish Vaswani'],
    year: 2017,
    url: 'https://arxiv.org/abs/1706.03762',
    doi: '',
  }
}

/** A document whose single reference is cited from its first paragraph. */
export function citedReferenceDocument(title = 'Reference management'): OpenDocument {
  const reference = citedReference()
  return editorWorkspaceDocument(title, (document) => {
    document.references = [reference]
    const paragraph = document.blocks[0]
    if (paragraph === undefined) {
      throw new Error('An empty document must start with a paragraph')
    }
    paragraph.content = [
      { type: 'text', text: 'A citation ', styles: {} },
      {
        type: 'citation',
        props: { referenceId: reference.id, locator: 'p. 3' },
      },
    ]
  })
}

/**
 * A document whose first block is a table and whose first cell cites its only
 * reference. A stored table can carry a cell as inline content or as a
 * `tableCell` node, so a case picks which encoding the citation arrives in.
 */
export function citedTableDocument(structured = false): OpenDocument {
  const reference = {
    id: crypto.randomUUID(),
    title: 'Cited in a table',
    authors: ['Author'],
    year: null,
    url: '',
    doi: '',
  }
  return editorWorkspaceDocument('Table citation', (document) => {
    document.references = [reference]
    document.blocks.unshift(tableBlock())
    const table = document.blocks[0]?.content
    if (table === undefined || Array.isArray(table) || table.rows[0] === undefined) {
      throw new Error('A table block must carry table content')
    }
    table.rows[0].cells[0] = [
      {
        type: 'citation',
        props: { referenceId: reference.id, locator: '' },
      },
    ]
    if (structured) {
      for (const row of table.rows) {
        row.cells = row.cells.map(cell => Array.isArray(cell)
          ? {
              type: 'tableCell',
              props: { textAlignment: 'left', textColor: 'default', backgroundColor: 'default' },
              content: cell,
            }
          : cell)
      }
    }
  })
}

/** The workspace envelope for a body the case built itself. */
export function workspaceDocument(title: string, body: Document): OpenDocument {
  return { ...editorWorkspaceDocument(title), document: body }
}

/** The text one table cell carries in a stored document. */
export function tableCellText(document: Document, row = 0, column = 0): string {
  const content = document.blocks.find(block => block.type === 'table')?.content
  if (content === undefined || Array.isArray(content)) {
    return ''
  }
  const cell = content.rows[row]?.cells[column]
  if (cell === undefined) {
    return ''
  }
  const inlines = Array.isArray(cell) ? cell : cell.content
  return inlines.map(inline => ('text' in inline ? inline.text : '')).join('')
}

/** The metadata a DOI lookup answers with: every field the form can fill. */
export const referenceMetadata: ReferenceMetadata = {
  doi: '10.1234/example',
  title: 'A Retrieved Research Paper',
  authors: ['Ada Lovelace', 'Grace Hopper'],
  year: 2026,
  url: 'https://doi.org/10.1234/example',
  source: 'Crossref',
}

/** The same lookup with only the DOI and URL: the partial result a form fills from. */
export const partialReferenceMetadata: ReferenceMetadata = {
  ...referenceMetadata,
  title: '',
  authors: [],
  year: null,
}

/**
 * The document a revision write carries. The client serializes the whole
 * envelope body, so a case validates the document a real save would have stored
 * instead of reading component state.
 */
export function writtenDocument(call: ApiCall): Document {
  const body = call.json
  if (typeof body !== 'object' || body === null || !('document' in body)) {
    throw new Error('A revision write must carry the document')
  }
  return validateDocument(body.document)
}

/** The reference list one revision write carried. */
export function writtenReferences(call: ApiCall): Document['references'] {
  return writtenDocument(call).references
}

/** The reference list each revision write carried, oldest first. */
export function writtenLists(calls: readonly ApiCall[]): Document['references'][] {
  return calls.filter(call => call.method === 'PUT').map(writtenReferences)
}

/** The document each revision write carried, oldest first. */
export function writtenDocuments(calls: readonly ApiCall[]): Document[] {
  return calls.filter(call => call.method === 'PUT').map(writtenDocument)
}

/** Everything the surface tried to write, so a draft can prove it wrote nothing. */
export function attemptedWrites(api: { readonly calls: readonly ApiCall[] }): ApiCall[] {
  return api.calls.filter(call => call.method !== 'GET')
}

/**
 * The revision write a reference save triggers. The acknowledgement only
 * carries the shape the client parses; storing the draft stays with the E2E
 * cases that own it.
 */
export const referenceSaveRoute: Readonly<Record<string, ApiHandler>> = {
  'PUT /api/admin/documents/:id/revisions': call => editorWorkspaceSaveAck(call),
}
