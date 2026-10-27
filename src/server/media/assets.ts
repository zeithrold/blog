import type { R2Bucket } from '@cloudflare/workers-types/index.ts'
import type { z } from 'zod'
import type { AssetRole } from '@/content/asset-refs'
import type { allocateAssetSchema, assetDescriptorSchema } from '@/contracts/media'
import type { Mutation } from '@/server/documents/repository-types'
import { assetAllocationSchema } from '@/contracts/media'
import { RepositoryCore } from '@/server/documents/repository-core'
import { Problem } from '@/server/http/problem'
import { mediaPolicy } from '@/server/media/media-policy'

export type AssetRow = {
  id: string
  object_key: string
  owner_sub: string
  filename: string
  role: AssetRole
  type: string
  declared_bytes: number
  sha256: string
  state: 'uploading' | 'ready' | 'rejected' | 'deleting' | 'deleted'
  created_at: number
  expires_at: number
  ready_at: number | null
  upload_claim: string | null
  bytes: number | null
  width: number | null
  height: number | null
  gc_after: number | null
  gc_attempts: number
}

export function descriptor(row: AssetRow): z.infer<typeof assetDescriptorSchema> {
  return {
    assetId: row.id,
    state: row.state,
    url: `/assets/${row.id}`,
    filename: row.filename,
    type: row.type,
    bytes: row.declared_bytes,
    sha256: row.sha256,
    role: row.role,
  }
}
export class AssetRepository extends RepositoryCore {
  protected async asset(id: string): Promise<AssetRow> {
    const row = await this.sql('SELECT * FROM assets WHERE id=?', id).first<AssetRow>()
    if (row === null) {
      throw new Problem(404, 'ASSET_NOT_FOUND')
    }
    return row
  }

  async status(id: string): Promise<z.infer<typeof assetDescriptorSchema>> {
    return descriptor(await this.asset(id))
  }

  async listAssets(cursor?: { time: number, id: string }): Promise<{
    items: z.infer<typeof assetDescriptorSchema>[]
    nextCursor: string | null
  }> {
    const condition
      = cursor === undefined ? '' : 'AND (created_at<? OR (created_at=? AND id>?))'
    const values = cursor === undefined
      ? []
      : [
          cursor.time,
          cursor.time,
          cursor.id,
        ]
    const rows = (
      await this.sql(
        `SELECT * FROM assets WHERE state!='deleted' ${condition} ORDER BY created_at DESC,id LIMIT 51`,
        ...values,
      ).all<AssetRow>()
    ).results
    const items = rows.slice(0, 50)
    const last = items.at(-1)
    return {
      items: items.map(descriptor),
      nextCursor:
        rows.length > 50 && last !== undefined ? `${last.created_at}:${last.id}` : null,
    }
  }

  async allocate(
    input: z.infer<typeof allocateAssetSchema>,
    mutation: Mutation,
  ): Promise<z.infer<typeof assetAllocationSchema>> {
    const replay = await this.replayAs(mutation, assetAllocationSchema)
    if (replay !== null) {
      return replay
    }
    const filename = mediaPolicy(input)
    const id = crypto.randomUUID()
    const now = Date.now()
    const response = {
      assetId: id,
      state: 'uploading' as const,
      uploadPath: `/api/admin/assets/${id}/content`,
    }
    const quota
      = '(SELECT COUNT(*)<100 AND COALESCE(SUM(declared_bytes),0)+?<=268435456 FROM assets WHERE created_at>=?)'
    try {
      await this.commit(
        [
          this.writableGuard(mutation, quota, [
            input.bytes,
            now - 86400000,
          ]),
          this.sql(
            `INSERT INTO
assets(id,object_key,owner_sub,filename,role,type,declared_bytes,sha256,state,created_at,expires_at)
          VALUES(?,?,?,?,?,?,?,?,'uploading',?,?)`,
            id,
            `media/${id}/${crypto.randomUUID()}`,
            mutation.actor,
            filename,
            input.role,
            input.type,
            input.bytes,
            input.sha256,
            now,
            now + 1800000,
          ),
          this.journal({
            mutation,
            id: null,
            operation: 'asset.allocate',
            response,
            now,
          }),
          this.end(mutation),
        ],
        mutation,
      )
    }
    catch (error) {
      if (error instanceof Problem && error.code === 'EDIT_CONFLICT') {
        throw new Problem(429, 'ASSET_ALLOCATION_QUOTA')
      }
      throw error
    }
    return (await this.replayAs(mutation, assetAllocationSchema)) ?? response
  }

  protected async claim(row: AssetRow, claim: string): Promise<void> {
    const mutation = {
      key: claim,
      hash: row.sha256,
      actor: row.owner_sub,
    }
    await this.commit(
      [
        this.writableGuard(
          mutation,
          `EXISTS(SELECT 1 FROM assets WHERE id=? AND state='uploading' AND upload_claim IS NULL AND expires_at>?)`,
          [
            row.id,
            Date.now(),
          ],
        ),
        this.sql(
          'UPDATE assets SET upload_claim=? WHERE id=? AND state=\'uploading\' AND upload_claim IS NULL',
          claim,
          row.id,
        ),
        this.end(mutation),
      ],
      mutation,
    )
  }

  protected async finalize(
    row: AssetRow,
    claim: string,
    dimensions: {
      width: number | null
      height: number | null
    },
  ): Promise<void> {
    const mutation = {
      key: `asset-upload:${row.id}`,
      hash: row.sha256,
      actor: row.owner_sub,
    }
    const now = Date.now()
    const response = descriptor({
      ...row,
      state: 'ready',
    })
    await this.commit(
      [
        this.writableGuard(
          mutation,
          'EXISTS(SELECT 1 FROM assets WHERE id=? AND state=\'uploading\' AND upload_claim=? AND expires_at>?)',
          [
            row.id,
            claim,
            now,
          ],
        ),
        this.sql(
          `UPDATE assets SET
state='ready',bytes=declared_bytes,width=?,height=?,ready_at=?,gc_after=? WHERE id=? AND
upload_claim=?`,
          dimensions.width,
          dimensions.height,
          now,
          now + 86400000,
          row.id,
          claim,
        ),
        this.journal({
          mutation,
          id: null,
          operation: 'asset.ready',
          response,
          now,
        }),
        this.end(mutation),
      ],
      mutation,
    )
  }

  protected async reject(row: AssetRow, claim: string, bucket: R2Bucket): Promise<void> {
    await this.sql(
      `UPDATE assets SET state='rejected',gc_after=? WHERE id=? AND state='uploading' AND
upload_claim=? AND (SELECT maintenance=0 FROM site_state WHERE id=1)`,
      Date.now() + 120000,
      row.id,
      claim,
    ).run()
    const current = await this.asset(row.id)
    if (current.state === 'rejected') {
      await bucket.delete(row.object_key)
    }
  }
}
