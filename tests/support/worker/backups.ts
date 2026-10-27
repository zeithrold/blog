import type { Runtime } from '~/tests/support/worker/runtime'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { equal } from '~/tests/support/unit/assertions'
import { json } from '~/tests/support/worker/responses'

export type Row = Record<string, string | number | null>
export type Exported = Map<string, Row[]>

/**
 * The restore order the operational procedure uses. Rows are written in one
 * transaction with deferred foreign keys, so the documents/revisions cycle
 * resolves at commit; every other position is chosen so a table's triggers
 * already see the rows they check: a ready asset before `revision_assets`, a
 * live document before `published_documents`.
 */
export const restoreOrder = [
  'site_state',
  'catalog',
  'assets',
  'documents',
  'revisions',
  'revision_assets',
  'revision_catalog',
  'published_documents',
  'published_catalog',
  'publication_events',
  'schedules',
  'mutations',
] as const
export const rowsSchema = z.object({
  items: z.array(
    z.record(z.string(), z.union([
      z.string(),
      z.number(),
      z.null(),
    ])),
  ),
  nextCursor: z.number().nullable(),
})
const manifestSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      sha256: z.string(),
      bytes: z.number(),
    }),
  ),
  nextCursor: z.string().nullable(),
})
type Insert = { sql: string, values: (string | number | null)[] }

/** Reads one table of a frozen backup to its end, keeping the export order. */
export async function exportTable(
  context: Runtime,
  backupId: string,
  table: string,
): Promise<Row[]> {
  const rows: Row[] = []
  let after = 0
  for (;;) {
    const page = await json(
      await context.fetch(
        `/api/admin/backups/${backupId}/rows?table=${table}&after=${after}`,
      ),
      200,
      rowsSchema,
    )
    rows.push(...page.items)
    if (page.nextCursor === null) {
      return rows
    }
    after = page.nextCursor
  }
}

/** Writes an export into an empty migrated database. */
export async function restoreDatabase(
  context: Runtime,
  exported: Exported,
): Promise<void> {
  const inserts = restoreOrder.flatMap(table =>
    insertsOf(table, exported.get(table) ?? []),
  )
  // One transaction: deferred foreign keys let the documents/revisions cycle
  // commit, and a failed import leaves the empty database untouched.
  await context.db.batch([
    context.db.prepare('PRAGMA defer_foreign_keys=ON'),
    ...inserts.map(insert => context.db.prepare(insert.sql).bind(...insert.values)),
  ])
}

function insertsOf(table: string, rows: Row[]): Insert[] {
  // `site_state` is the single row migration 0001 already created.
  const conflict = table === 'site_state' ? 'OR REPLACE ' : ''
  return rows.map((row) => {
    const columns = Object.keys(row).filter(name => !name.startsWith('_'))
    return {
      sql: `INSERT ${conflict}INTO ${table} (${columns.join(',')})
        VALUES (${columns.map(() => '?').join(',')})`,
      values: columns.map(column => row[column] ?? null),
    }
  })
}

/** Copies the backup manifest's objects into the restored bucket. */
export async function copyMedia(
  source: Runtime,
  target: Runtime,
  backupId: string,
): Promise<number> {
  const items = await manifest(source, backupId)
  for (const item of items) {
    const stored = await source.media.get(item.key)
    if (stored === null) {
      throw new Error(`missing object ${item.key}`)
    }
    const bytes = Buffer.from(await stored.arrayBuffer())
    // The manifest is the contract between the exported rows and the objects the
    // operator copies into the new bucket.
    equal(createHash('sha256').update(bytes).digest('hex'), item.sha256)
    equal(bytes.byteLength, item.bytes)
    await target.media.put(item.key, bytes, {
      httpMetadata: stored.httpMetadata,
      customMetadata: stored.customMetadata,
    })
  }
  return items.length
}

async function manifest(
  source: Runtime,
  backupId: string,
): Promise<z.infer<typeof manifestSchema>['items']> {
  const items: z.infer<typeof manifestSchema>['items'] = []
  let after = ''
  for (;;) {
    const page = await json(
      await source.fetch(`/api/admin/backups/${backupId}/manifest?after=${after}`),
      200,
      manifestSchema,
    )
    items.push(...page.items)
    if (page.nextCursor === null) {
      return items
    }
    after = page.nextCursor
  }
}
