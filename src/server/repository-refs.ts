import type { D1PreparedStatement } from '@cloudflare/workers-types/index.ts'
import type { Document } from '@/content/document'
import { assetReferences } from '@/content/asset-refs'
import { ReadRepository } from '@/server/repository-read'

export class ReferenceRepository extends ReadRepository {
  protected referenceStatements(
    revisionId: string,
    document: Document,
  ): D1PreparedStatement[] {
    const assets = assetReferences(document)
    const catalog = [
      ...document.meta.tags.map(tag => ({
        id: tag.id,
        kind: 'tag',
        position: null,
      })),
      ...document.meta.series.map(series => ({
        id: series.id,
        kind: 'series',
        position: series.position,
      })),
    ]
    return [
      this.sql(
        `INSERT INTO revision_assets(revision_id,asset_id,role)
        SELECT ?,json_extract(value,'$.assetId'),json_extract(value,'$.role') FROM json_each(?)`,
        revisionId,
        JSON.stringify(assets),
      ),
      this.sql(
        `INSERT INTO revision_catalog(revision_id,catalog_id,kind,position)
        SELECT
?,json_extract(value,'$.id'),json_extract(value,'$.kind'),json_extract(value,'$.position') FROM json_each(?)`,
        revisionId,
        JSON.stringify(catalog),
      ),
    ]
  }

  protected publicationCatalog(id: string, document: Document): D1PreparedStatement {
    const catalog = [
      ...document.meta.tags.map(tag => ({
        id: tag.id,
        kind: 'tag',
        slug: tag.slug,
        label: tag.label,
        position: null,
      })),
      ...document.meta.series.map(series => ({
        id: series.id,
        kind: 'series',
        slug: series.slug,
        label: series.title,
        position: series.position,
      })),
    ]
    return this.sql(
      `INSERT INTO published_catalog(document_id,catalog_id,kind,slug,label,position)
      SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.kind'),json_extract(value,'$.slug'),
      json_extract(value,'$.label'),json_extract(value,'$.position') FROM json_each(?)`,
      id,
      JSON.stringify(catalog),
    )
  }
}
