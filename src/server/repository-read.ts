import type { Document } from '@/content/document'
import type { DocumentFilters } from '@/content/document-list-query'
import type { DocumentListRow } from '@/server/document-list-sql'
import type { OpenDocument, Row } from '@/server/repository-types'
import { hanTokens } from '@/content/canonical'
import { validateDocument } from '@/content/document'
import { defaultDocumentFilters } from '@/content/document-list-query'
import { listCursor } from '@/server/document-list-query'
import { documentListItem, documentListSQL } from '@/server/document-list-sql'
import { Problem } from '@/server/problem'
import { RepositoryCore } from '@/server/repository-core'

export class ReadRepository extends RepositoryCore {
  async revision(
    id: string,
    revisionId: string,
  ): Promise<{
    revisionId: string
    contentSha256: string
    document: Document
  }> {
    const value = await this.sql(
      'SELECT canonical_json,content_sha256 FROM revisions WHERE id=? AND document_id=?',
      revisionId,
      id,
    ).first<{
      canonical_json: string
      content_sha256: string
    }>()
    if (!(value !== null)) {
      throw new Problem(404, 'REVISION_NOT_FOUND')
    }
    return {
      revisionId,
      contentSha256: value.content_sha256,
      document: validateDocument(JSON.parse(value.canonical_json)),
    }
  }

  async open(id: string): Promise<OpenDocument> {
    const value = await this.sql(
      `SELECT d.*,r.canonical_json,p.path FROM documents d
      JOIN revisions r ON r.document_id=d.id AND r.id=d.head_revision_id
      LEFT JOIN published_documents p ON p.document_id=d.id AND p.revision_id=d.live_revision_id
      WHERE d.id=? AND d.deleted_at IS NULL`,
      id,
    ).first<
      Row & {
        canonical_json: string
        path: string | null
      }
    >()
    if (!(value !== null)) {
      throw new Problem(404, 'DOCUMENT_NOT_FOUND')
    }
    return {
      ...this.ack(value),
      kind: value.kind,
      livePath: value.path,
      document: validateDocument(JSON.parse(value.canonical_json)),
    }
  }

  async list(cursor?: { time: number, id: string }, filters: DocumentFilters = defaultDocumentFilters): Promise<{
    items: unknown[]
    nextCursor: string | null
  }> {
    const { query, values } = documentListSQL(filters, cursor)
    const rows = await this.sql(query, ...values).all<DocumentListRow>()
    const items = rows.results.slice(0, 50).map(documentListItem)
    const last = items.at(-1)
    return {
      items,
      nextCursor:
        rows.results.length > 50 && last !== undefined
          ? listCursor({ time: last.updatedAt, id: last.documentId }, filters)
          : null,
    }
  }

  async history(
    id: string,
    before = Number.MAX_SAFE_INTEGER,
  ): Promise<{
    items: unknown[]
    nextBefore: number | null
  }> {
    await this.row(id)
    const rows = await this.sql(
      `SELECT id AS revisionId,sequence,reason,created_at AS createdAt,restored_from_id AS
restoredFromId,content_sha256 AS contentSha256
      FROM revisions WHERE document_id=? AND sequence<? ORDER BY sequence DESC LIMIT 51`,
      id,
      before,
    ).all<{
      sequence: number
    }>()
    const items = rows.results.slice(0, 50)
    return {
      items,
      nextBefore: rows.results.length > 50 ? (items.at(-1)?.sequence ?? null) : null,
    }
  }

  async publicDocument(path: string): Promise<Document | null> {
    return (await this.publicEntry(path))?.document ?? null
  }

  async publicEntry(path: string): Promise<{
    document: Document
    publishedAt: number
    updatedAt: number
  } | null> {
    const value = await this.sql(
      `SELECT r.canonical_json,p.published_at AS publishedAt,p.updated_at AS updatedAt
FROM published_documents p
      JOIN documents d ON d.id=p.document_id AND d.live_revision_id=p.revision_id AND
d.deleted_at IS NULL
      JOIN revisions r ON r.id=p.revision_id AND r.document_id=p.document_id WHERE
p.path=?`,
      path,
    ).first<{
      canonical_json: string
      publishedAt: number
      updatedAt: number
    }>()
    return value !== null
      ? {
          document: validateDocument(JSON.parse(value.canonical_json), true),
          publishedAt: value.publishedAt,
          updatedAt: value.updatedAt,
        }
      : null
  }

  async publicList(): Promise<
    {
      title: string
      description: string
      path: string
      publishedAt: number
    }[]
  > {
    return (
      await this.sql(
        `SELECT p.title,p.description,p.path,p.published_at AS publishedAt FROM
published_documents p
      JOIN documents d ON d.id=p.document_id AND d.live_revision_id=p.revision_id AND
d.deleted_at IS NULL
      WHERE p.kind='article' ORDER BY p.published_at DESC,p.document_id LIMIT 50`,
      ).all<{
        title: string
        description: string
        path: string
        publishedAt: number
      }>()
    ).results
  }

  async search(
    query: string,
    offset: number,
  ): Promise<{
    items: {
      title: string
      path: string
      description: string
      excerpt: string
    }[]
    nextOffset: number | null
  }> {
    if (query.length > 120 || offset < 0 || offset > 180 || !Number.isSafeInteger(offset)) {
      throw new Problem(400, 'INVALID_QUERY')
    }
    const terms
      = query
        .normalize('NFKC')
        .trim()
        .match(/[\p{L}\p{N}_+#.-]+/gu) ?? []
    if (!(terms.length !== 0)) {
      return {
        items: [],
        nextOffset: null,
      }
    }
    if (terms.length > 16) {
      throw new Problem(400, 'INVALID_QUERY')
    }
    const tokens = terms.flatMap(term =>
      /\p{Script=Han}/u.test(term) ? hanTokens(term).split(' ') : [term],
    )
    const match = tokens.map(term => `"${term.replaceAll('"', '""')}"`).join(' AND ')
    const hanTerms = terms.filter(term => /\p{Script=Han}/u.test(term))
    const rows = await this.sql(
      `SELECT p.title,p.path,p.description,p.plain_text AS text FROM search_lexical f
      JOIN published_documents p ON p.row_id=f.rowid JOIN documents d ON
d.id=p.document_id AND d.live_revision_id=p.revision_id
      WHERE search_lexical MATCH ? AND p.searchable=1 AND d.deleted_at IS NULL
      ${hanTerms.map(() => 'AND instr(p.plain_text,?)>0').join(' ')}
      ORDER BY bm25(search_lexical),p.document_id LIMIT 21 OFFSET ?`,
      match,
      ...hanTerms,
      offset,
    ).all<{
      title: string
      path: string
      description: string
      text: string
    }>()
    return {
      items: rows.results.slice(0, 20).map(item => ({
        title: item.title,
        path: item.path,
        description: item.description,
        excerpt: item.text.slice(0, 240),
      })),
      nextOffset: rows.results.length > 20 && offset < 180 ? offset + 20 : null,
    }
  }
}
