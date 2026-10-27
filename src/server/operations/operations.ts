import type { Mutation } from '@/server/documents/repository-types'
import { z } from 'zod'
import { UUID } from '@/content/document'
import { resumeSchema } from '@/contracts/operations'
import { RepositoryCore } from '@/server/documents/repository-core'
import { Problem } from '@/server/http/problem'

// The export is the site's content plus its public projection. Derived search
// index tables (`search_lexical`) are left out because `public_insert` and
// `public_update` rebuild them from the projection rows a restore inserts, and
// `backup_runs`, `backup_assets` and `txn_guards` are instance state: a restored
// site starts its own backup history and no in-flight transaction locks.
export const backupTables = [
  'site_state',
  'documents',
  'catalog',
  'assets',
  'revisions',
  'revision_assets',
  'revision_catalog',
  'published_documents',
  'published_catalog',
  'publication_events',
  'mutations',
  'schedules',
] as const
type BackupTable = (typeof backupTables)[number]
/**
 * `site_state` is exported as the row a restore must start from, not as the row
 * the frozen source holds. `maintenance` is the freeze that produced this backup
 * and its `backup_runs` row stays behind, so the restored row is held for the
 * owner with no owner (`resume` opens it) instead of pointing at a run the
 * restored site does not have. `content_bytes` is derived by `revision_storage`
 * from the revisions the restore inserts.
 */
const exportColumns: Partial<Record<BackupTable, string>> = {
  site_state:
    'id,public_generation,0 AS content_bytes,1 AS maintenance,NULL AS maintenance_owner,NULL AS maintenance_since',
}
export const freezeSchema = z.strictObject({
  backupId: UUID,
  epoch: z.number().int(),
  state: z.literal('frozen'),
})
export const releaseSchema = z.strictObject({
  backupId: UUID,
  state: z.enum(['complete', 'failed']),
})
export const finishBackupSchema = z.strictObject({
  backupId: UUID,
  manifestSha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
})
export class Operations extends RepositoryCore {
  async health(): Promise<unknown> {
    const state = await this.sql(
      `SELECT public_generation AS publicGeneration,maintenance,content_bytes AS
contentBytes,maintenance_since AS maintenanceSince,maintenance_owner AS maintenanceOwner FROM site_state WHERE id=1`,
    ).first()
    const bytes = await this.databaseBytes()
    const lag = await this.sql(
      'SELECT MIN(run_at) AS oldest,COUNT(*) AS pending FROM schedules WHERE state=\'pending\'',
    ).first<{
      oldest: number | null
      pending: number
    }>()
    const failed = await this.sql(
      'SELECT COUNT(*) AS count FROM schedules WHERE state=\'failed\'',
    ).first<{
      count: number
    }>()
    return {
      ...state,
      databaseBytes: bytes,
      capacity: capacity(bytes),
      ...scheduleHealth(lag, failed),
      ...(await this.counters()),
      lastBackupAt:
        (
          await this.sql(
            'SELECT MAX(completed_at) AS time FROM backup_runs WHERE state=\'complete\'',
          ).first<{ time: number | null }>()
        )?.time ?? null,
    }
  }

  private async counters(): Promise<Record<string, number>> {
    const result = await this.sql(
      `SELECT
      (SELECT COUNT(*) FROM documents WHERE deleted_at IS NULL) AS documents,
      (SELECT COUNT(*) FROM revisions) AS revisions,
      (SELECT COUNT(*) FROM assets WHERE state='ready') AS readyAssets,
      (SELECT COALESCE(SUM(declared_bytes),0) FROM assets WHERE state='ready') AS assetBytes,
      (SELECT COUNT(*) FROM published_documents WHERE searchable=1) AS searchableDocuments`,
    ).first<Record<string, number>>()
    return (
      result ?? {
        documents: 0,
        revisions: 0,
        readyAssets: 0,
        assetBytes: 0,
        searchableDocuments: 0,
      }
    )
  }

  async resume(generation: number, mutation: Mutation): Promise<z.infer<typeof resumeSchema>> {
    const replay = await this.replayAs(mutation, resumeSchema)
    if (replay !== null) {
      return replay
    }
    const response = { state: 'writable' as const, publicGeneration: generation }
    await this.commit(
      [
        this.sql(
          `INSERT INTO txn_guards(id,ok) SELECT ?,maintenance=1 AND maintenance_owner IS NULL AND public_generation=?
          FROM site_state WHERE id=1`,
          mutation.key,
          generation,
        ),
        this.sql('UPDATE site_state SET maintenance=0,maintenance_since=NULL WHERE id=1'),
        this.journal({
          mutation,
          id: null,
          operation: 'restore.resume',
          response,
          now: Date.now(),
        }),
        this.end(mutation),
      ],
      mutation,
    )
    return (await this.replayAs(mutation, resumeSchema)) ?? response
  }

  async freeze(mutation: Mutation): Promise<z.infer<typeof freezeSchema>> {
    const replay = await this.replayAs(mutation, freezeSchema)
    if (replay !== null) {
      return replay
    }
    const now = Date.now()
    const response = {
      backupId: crypto.randomUUID(),
      epoch: now,
      state: 'frozen' as const,
    }
    await this.commit(
      [
        this.writableGuard(mutation),
        this.sql(
          'UPDATE site_state SET maintenance=1,maintenance_owner=?,maintenance_since=? WHERE id=1',
          response.backupId,
          now,
        ),
        this.sql(
          'INSERT INTO backup_runs(id,state,actor_sub,epoch,created_at) VALUES(?,\'frozen\',?,?,?)',
          response.backupId,
          mutation.actor,
          now,
          now,
        ),
        this.sql(
          'INSERT INTO backup_assets(backup_id,asset_id) SELECT ?,id FROM assets WHERE state=\'ready\'',
          response.backupId,
        ),
        this.journal({
          mutation,
          id: null,
          operation: 'backup.freeze',
          response,
          now,
        }),
        this.end(mutation),
      ],
      mutation,
    )
    return (await this.replayAs(mutation, freezeSchema)) ?? response
  }

  async frozen(id: string): Promise<void> {
    const value = await this.sql(
      `SELECT 1 AS ok FROM site_state s JOIN backup_runs b ON b.id=s.maintenance_owner WHERE
s.id=1 AND s.maintenance=1 AND b.id=? AND b.state='frozen'`,
      id,
    ).first()
    if (value === null) {
      throw new Problem(409, 'BACKUP_NOT_FROZEN')
    }
  }

  async page(id: string, table: string, after: number): Promise<unknown> {
    await this.frozen(id)
    if (!isBackupTable(table) || !Number.isSafeInteger(after) || after < 0) {
      throw new Problem(400, 'INVALID_QUERY')
    }
    // The only SQL identifier is selected from the fixed table allowlist above.
    const result = await this.sql(
      `SELECT rowid AS _cursor,${exportColumns[table] ?? '*'} FROM ${table} WHERE rowid>? ORDER BY rowid LIMIT 1`,
      after,
    ).all<{
      _cursor: number
    }>()
    return {
      items: result.results,
      nextCursor: result.results.at(-1)?._cursor ?? null,
    }
  }

  async manifest(id: string, after: string): Promise<unknown> {
    await this.frozen(id)
    const result = await this.sql(
      `SELECT a.id,a.object_key AS key,a.sha256,a.declared_bytes AS bytes FROM assets a
      JOIN backup_assets b ON b.asset_id=a.id AND b.backup_id=? WHERE a.id>? ORDER BY a.id LIMIT 50`,
      id,
      after,
    ).all<{
      id: string
      key: string
      sha256: string
      bytes: number
    }>()
    return {
      items: result.results,
      nextCursor: result.results.at(-1)?.id ?? null,
    }
  }

  async finish(
    input: z.infer<typeof finishBackupSchema>,
    mutation: Mutation,
  ): Promise<z.infer<typeof releaseSchema>> {
    const replay = await this.replayAs(mutation, releaseSchema)
    if (replay !== null) {
      return replay
    }
    const now = Date.now()
    const response = {
      backupId: input.backupId,
      state: input.manifestSha256 === null ? ('failed' as const) : ('complete' as const),
    }
    const condition
      = 'maintenance=1 AND maintenance_owner=? AND EXISTS(SELECT 1 FROM backup_runs WHERE id=? AND state=\'frozen\')'
    await this.commit(
      [
        this.sql(
          `INSERT INTO txn_guards(id,ok) SELECT ?,(${condition}) FROM site_state WHERE id=1`,
          mutation.key,
          input.backupId,
          input.backupId,
        ),
        this.sql(
          'UPDATE backup_runs SET state=?,completed_at=?,manifest_sha256=? WHERE id=?',
          response.state,
          now,
          input.manifestSha256,
          input.backupId,
        ),
        this.sql(
          'UPDATE site_state SET maintenance=0,maintenance_owner=NULL,maintenance_since=NULL WHERE id=1',
        ),
        this.journal({
          mutation,
          id: null,
          operation: 'backup.release',
          response,
          now,
        }),
        this.end(mutation),
      ],
      mutation,
    )
    return (await this.replayAs(mutation, releaseSchema)) ?? response
  }
}

function isBackupTable(table: string): table is BackupTable {
  return (backupTables as readonly string[]).includes(table)
}

function capacity(bytes: number): string {
  if (bytes >= 8589934592) {
    return 'critical'
  }
  if (bytes >= 7516192768) {
    return 'warning'
  }
  return 'normal'
}

function scheduleHealth(
  lag: { oldest: number | null, pending: number } | null,
  failed: { count: number } | null,
): Record<string, number> {
  return {
    pendingSchedules: lag?.pending ?? 0,
    scheduleLagMs: Math.max(0, Date.now() - (lag?.oldest ?? Date.now())),
    failedSchedules: failed?.count ?? 0,
  }
}
