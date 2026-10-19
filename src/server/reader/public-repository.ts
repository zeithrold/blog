import { Repository } from '@/server/documents/repository'
import { Problem } from '@/server/http/problem'

export type PublicItem = {
  title: string
  description: string
  path: string
  publishedAt: number
  updatedAt: number
  documentId: string
}

export class PublicRepository extends Repository {
  async feed(limit = 100): Promise<PublicItem[]> {
    return (
      await this.sql(
        `SELECT p.title,p.description,p.path,p.published_at AS publishedAt,p.updated_at AS
updatedAt,p.document_id AS documentId
      FROM published_documents p JOIN documents d ON d.id=p.document_id AND
d.live_revision_id=p.revision_id
      WHERE p.kind='article' AND p.searchable=1 AND d.deleted_at IS NULL ORDER BY
p.published_at DESC,p.document_id LIMIT ?`,
        limit,
      ).all<PublicItem>()
    ).results
  }

  async routeCount(): Promise<number> {
    const row = await this.sql(
      `SELECT COUNT(*) AS n FROM published_documents p JOIN documents d
      ON d.id=p.document_id AND d.live_revision_id=p.revision_id
      WHERE p.searchable=1 AND d.deleted_at IS NULL`,
    ).first<{ n: number }>()
    return row?.n ?? 0
  }

  async routes(offset = 0): Promise<
    {
      path: string
      updatedAt: number
    }[]
  > {
    return (
      await this.sql(
        `SELECT p.path,p.updated_at AS updatedAt FROM published_documents p JOIN documents d
      ON d.id=p.document_id AND d.live_revision_id=p.revision_id WHERE p.searchable=1
AND d.deleted_at IS NULL
      ORDER BY p.path LIMIT 1000 OFFSET ?`,
        offset,
      ).all<{
        path: string
        updatedAt: number
      }>()
    ).results
  }

  async taxonomy(
    kind: 'tag' | 'series',
    slug: string,
    offset = 0,
  ): Promise<{
    label: string
    items: PublicItem[]
    nextOffset: number | null
  } | null> {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) {
      throw new Problem(400, 'INVALID_QUERY')
    }
    const rows = await this.sql(
      `SELECT p.title,p.description,p.path,p.published_at AS publishedAt,p.updated_at AS
updatedAt,
      p.document_id AS documentId,c.label FROM published_catalog c JOIN
published_documents p ON p.document_id=c.document_id
      JOIN documents d ON d.id=p.document_id AND d.live_revision_id=p.revision_id WHERE
c.kind=? AND c.slug=? AND d.deleted_at IS NULL
      ORDER BY ${kind === 'series' ? 'c.position' : 'p.published_at DESC'},p.document_id LIMIT 51 OFFSET ?`,
      kind,
      slug,
      offset,
    ).all<
      PublicItem & {
        label: string
      }
    >()
    const first = rows.results[0]
    if (first === undefined) {
      return null
    }
    return {
      label: first.label,
      items: rows.results.slice(0, 50),
      nextOffset: rows.results.length > 50 ? offset + 50 : null,
    }
  }

  async posts(offset: number): Promise<{
    items: PublicItem[]
    nextOffset: number | null
  }> {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) {
      throw new Problem(400, 'INVALID_QUERY')
    }
    const rows = await this.sql(
      `SELECT p.title,p.description,p.path,p.published_at AS publishedAt,p.updated_at AS
updatedAt,p.document_id AS documentId
      FROM published_documents p JOIN documents d ON d.id=p.document_id AND
d.live_revision_id=p.revision_id
      WHERE p.kind='article' AND d.deleted_at IS NULL ORDER BY p.published_at
DESC,p.document_id LIMIT 51 OFFSET ?`,
      offset,
    ).all<PublicItem>()
    return {
      items: rows.results.slice(0, 50),
      nextOffset: rows.results.length > 50 ? offset + 50 : null,
    }
  }
}
