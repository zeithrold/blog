import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts'
import type { z } from 'zod'
import type { assetDescriptorSchema } from '@/contracts/media'
import type { AssetRow } from '@/server/media/assets'
import { Problem } from '@/server/http/problem'
import { AssetRepository, descriptor } from '@/server/media/assets'
import { transfer } from '@/server/media/media-stream'

function headers(request: Request, row: AssetRow, owner: string): void {
  if (row.owner_sub !== owner) {
    throw new Problem(403, 'ASSET_OWNER_REQUIRED')
  }
  if (
    request.headers.get('content-type') !== row.type
    || request.headers.get('content-length') !== String(row.declared_bytes)
  ) {
    throw new Problem(422, 'ASSET_HEADERS_MISMATCH')
  }
}
export class AssetUpload extends AssetRepository {
  constructor(
    db: D1Database,
    private readonly bucket: R2Bucket,
  ) {
    super(db)
  }

  private async claimKnown(row: AssetRow, claim: string): Promise<void> {
    try {
      await this.claim(row, claim)
    }
    catch (error) {
      const current = await this.asset(row.id)
      if (current.upload_claim !== claim || current.state !== 'uploading') {
        throw error
      }
    }
  }

  async upload(
    request: Request,
    id: string,
    owner: string,
  ): Promise<z.infer<typeof assetDescriptorSchema>> {
    const row = await this.asset(id)
    headers(request, row, owner)
    if (row.state === 'ready') {
      await request.body?.cancel()
      return descriptor(row)
    }
    if (row.state !== 'uploading' || row.expires_at <= Date.now()) {
      throw new Problem(409, 'UPLOAD_SESSION_EXPIRED')
    }
    if (request.body === null) {
      throw new Problem(422, 'ASSET_LENGTH_MISMATCH')
    }
    const claim = `upload-claim:${crypto.randomUUID()}`
    await this.claimKnown(row, claim)
    let dimensions: {
      width: number | null
      height: number | null
    }
    try {
      dimensions = await transfer({
        body: request.body,
        bucket: this.bucket,
        key: row.object_key,
        type: row.type,
        bytes: row.declared_bytes,
        sha256: row.sha256,
      })
    }
    catch (error) {
      await this.reject(row, claim, this.bucket).catch(() => undefined)
      throw error
    }
    return await this.finishUpload(row, claim, dimensions)
  }

  private async finishUpload(
    row: AssetRow,
    claim: string,
    dimensions: { width: number | null, height: number | null },
  ): Promise<z.infer<typeof assetDescriptorSchema>> {
    try {
      await this.finalize(row, claim, dimensions)
    }
    catch (error) {
      const current = await this.asset(row.id)
      if (current.state === 'ready') {
        return descriptor(current)
      }
      await this.sql(
        `UPDATE assets SET upload_claim=NULL WHERE id=? AND state='uploading'
          AND upload_claim=? AND (SELECT maintenance=0 FROM site_state WHERE id=1)`,
        row.id,
        claim,
      ).run()
      throw error
    }
    return await this.status(row.id)
  }
}
