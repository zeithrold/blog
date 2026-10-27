import type { R2Bucket } from '@cloudflare/workers-types/index.ts'
import type { AssetRow } from '@/server/media/assets'
import { AssetRepository } from '@/server/media/assets'

/** Collection only removes objects, so the bucket is narrowed to what it uses. */
type ObjectBucket = Pick<R2Bucket, 'delete'>

export class AssetGC extends AssetRepository {
  /**
   * A failed deletion must not keep the object at the head of the batch order,
   * or ten permanently failing objects would hide every later one. The retry
   * moves the same `gc_after` clock the batch is ordered by, doubling from this
   * base up to a one-day ceiling so cleanup is delayed, never abandoned.
   */
  static readonly retryBaseMs = 900000
  static readonly retryMaxMs = 86400000

  async collect(bucket: ObjectBucket, now = Date.now()): Promise<number> {
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
        await this.defer(row, now)
      }
    }
    return count
  }

  private async remove(row: AssetRow, bucket: ObjectBucket, now: number): Promise<boolean> {
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
      `UPDATE assets SET state='deleted',gc_attempts=0,gc_after=? WHERE id=? AND state IN ('deleting','deleted')
       AND (SELECT maintenance=0 FROM site_state WHERE id=1)`,
      now + 86400000,
      row.id,
    ).run()
    return true
  }

  private async defer(row: AssetRow, now: number): Promise<void> {
    // Only the retry clock changes, so the reference and backup-pin guards keep
    // deciding whether this row may be deleted at all. The row's state is not
    // matched: a failed deletion has already claimed it into `deleting`.
    await this.sql(
      'UPDATE assets SET gc_attempts=gc_attempts+1,gc_after=? WHERE id=?',
      now + retryDelay(row.gc_attempts + 1),
      row.id,
    ).run()
  }
}

function retryDelay(attempts: number): number {
  return Math.min(
    AssetGC.retryBaseMs * 2 ** Math.min(attempts, 16),
    AssetGC.retryMaxMs,
  )
}
