import type { R2Bucket } from '@cloudflare/workers-types/index.ts'
import type { AssetRow } from '@/server/assets'
import { AssetRepository } from '@/server/assets'

export class AssetGC extends AssetRepository {
  async collect(bucket: R2Bucket, now = Date.now()): Promise<number> {
    const state = await this.sql('SELECT maintenance FROM site_state WHERE id=1').first<{
      maintenance: number
    }>()
    if (state?.maintenance !== 0) {
      return 0
    }
    await this.sql(
      `UPDATE assets SET state='rejected',gc_after=? WHERE state='uploading' AND expires_at<?
      AND (SELECT maintenance=0 FROM site_state WHERE id=1)`,
      now + 120000,
      now - 120000,
    ).run()
    const rows = await this.sql(
      `SELECT a.* FROM assets a WHERE
      (state IN ('ready','rejected','deleting','deleted') AND gc_after<=?)
      AND NOT EXISTS(SELECT 1 FROM revision_assets WHERE asset_id=a.id)
      AND NOT EXISTS(SELECT 1 FROM backup_assets ba JOIN backup_runs b ON b.id=ba.backup_id
        WHERE ba.asset_id=a.id AND b.state='frozen') ORDER BY gc_after,id LIMIT 10`,
      now,
    ).all<AssetRow>()
    let count = 0
    for (const row of rows.results) {
      try {
        if (await this.remove(row, bucket, now)) {
          count++
        }
      }
      catch (error) {
        console.error(
          'MEDIA_GC_FAILED',
          row.id,
          error instanceof Error ? error.name : 'Unknown',
        )
      }
    }
    return count
  }

  private async remove(row: AssetRow, bucket: R2Bucket, now: number): Promise<boolean> {
    const claimed = await this.sql(
      `UPDATE assets SET state=CASE WHEN state='deleted' THEN 'deleted' ELSE 'deleting' END
      WHERE id=? AND state=? AND (SELECT maintenance=0 FROM site_state WHERE id=1)
      AND NOT EXISTS(SELECT 1 FROM revision_assets WHERE asset_id=assets.id)`,
      row.id,
      row.state,
    ).run()
    if (claimed.meta.changes === 0) {
      return false
    }
    await bucket.delete(row.object_key)
    // Recheck tombstones daily: a put with an unknown outcome may complete after a cleanup pass.
    await this.sql(
      `UPDATE assets SET state='deleted',gc_after=? WHERE id=? AND state IN ('deleting','deleted')
       AND (SELECT maintenance=0 FROM site_state WHERE id=1)`,
      now + 86400000,
      row.id,
    ).run()
    return true
  }
}
