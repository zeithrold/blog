import type { Exported } from '~/tests/support/worker/backups'
import type { Runtime } from '~/tests/support/worker/runtime'
import type { StoredMedia } from '~/tests/support/worker/uploads'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import { z } from 'zod'
import { catalogItemSchema } from '@/contracts/catalog'
import { acknowledgementSchema, openDocumentSchema } from '@/contracts/documents'
import { operationsSchema, resumeSchema } from '@/contracts/operations'
import { deepEqual, equal } from '~/tests/support/unit/assertions'
import { copyMedia, exportTable, restoreDatabase, restoreOrder } from '~/tests/support/worker/backups'
import { json, refusal } from '~/tests/support/worker/responses'
import { runtime } from '~/tests/support/worker/runtime'
import { uploadFile } from '~/tests/support/worker/uploads'

/**
 * Backup export, restore into an empty database, public reads, then the owner's
 * resume. The frozen snapshot is the only source of the restored site, so public
 * pages, search, media and the maintenance lock are all decided by what the
 * export contains.
 */
const freezeSchema = z.object({
  backupId: z.string(),
  epoch: z.number(),
  state: z.literal('frozen'),
})
// Instance state is not content: the source's backup run and its pins, the
// transient transaction guards, and the derived search index a restore rebuilds
// from the projection rows.
const instanceTables = [
  'backup_runs',
  'backup_assets',
  'txn_guards',
  'search_lexical',
]
const mediaBytes = Buffer.from('Restorable media payload')
type Health = z.infer<typeof operationsSchema>

test('backup export restores public reads, search, media and a resumable lock', async () => {
  const source = await runtime()
  const target = await runtime()
  try {
    const published = await publishWithMedia(source)
    const before = await json(
      await source.fetch('/api/admin/operations'),
      200,
      operationsSchema,
    )
    const backup = await json(
      await source.write('/api/admin/backups/freeze', {}),
      201,
      freezeSchema,
    )
    const exported = await exportBackup(source, backup.backupId)
    await restoreDatabase(target, exported)
    equal(await copyMedia(source, target, backup.backupId), 1)

    const restored = await json(
      await target.fetch('/api/admin/operations'),
      200,
      operationsSchema,
    )
    assertQuarantined(restored, before)
    await assertPublicReads(target, published)
    await assertOwnerAcceptsWrites(target, backup.backupId, restored)
  }
  finally {
    await source.dispose()
    await target.dispose()
  }
}).catch((error: unknown) => { throw error })

async function exportBackup(source: Runtime, backupId: string): Promise<Exported> {
  const exported: Exported = new Map()
  for (const table of restoreOrder) {
    exported.set(table, await exportTable(source, backupId, table))
  }
  // The snapshot must carry the public projection, not just the private tables:
  // reading and searching are served from `published_documents`.
  equal((exported.get('published_documents') ?? []).length, 1)
  equal((exported.get('published_catalog') ?? []).length, 1)
  for (const table of instanceTables) {
    equal(
      await refusal(
        await source.fetch(`/api/admin/backups/${backupId}/rows?table=${table}&after=0`),
        400,
      ),
      'INVALID_QUERY',
    )
  }
  return exported
}

function assertQuarantined(restored: Health, before: Health): void {
  // A restore quarantines writes until the owner accepts the data, but the lock
  // belongs to nobody: the backup that produced the snapshot is not restored, so
  // `resume` is what opens the site.
  equal(restored.maintenance, 1)
  equal(restored.maintenanceOwner, null)
  equal(restored.publicGeneration, before.publicGeneration)
  // Counters no restored table carries are rebuilt by the restore's own inserts.
  equal(restored.contentBytes, before.contentBytes)
  deepEqual(counted(restored), counted(before))
}

function counted(data: Health): Record<string, number> {
  return {
    documents: data.documents,
    revisions: data.revisions,
    readyAssets: data.readyAssets,
    assetBytes: data.assetBytes,
    searchableDocuments: data.searchableDocuments,
  }
}

async function assertPublicReads(
  target: Runtime,
  published: { path: string, assetId: string },
): Promise<void> {
  const page = await target.fetch(`/${published.path}`)
  equal(page.status, 200, await page.clone().text())
  equal((await page.text()).includes('Restorable post'), true)
  const search = await target.fetch('/search?q=Restorable')
  equal(search.status, 200, await search.clone().text())
  equal((await search.text()).includes('Restorable post'), true)
  const tag = await target.fetch('/tags/restored')
  equal(tag.status, 200, await tag.clone().text())
  const media = await target.fetch(`/assets/${published.assetId}`)
  equal(media.status, 200, await media.clone().text())
  deepEqual(Buffer.from(await media.arrayBuffer()), mediaBytes)
}

async function assertOwnerAcceptsWrites(
  target: Runtime,
  backupId: string,
  restored: Health,
): Promise<void> {
  // Writes stay closed while the restored data is unaccepted.
  equal(
    await refusal(await target.write('/api/admin/documents', {}), 503),
    'MAINTENANCE',
  )
  // Finishing the source backup is not part of a restore: the restored site
  // holds no lock for it and refuses to settle a run it does not own.
  equal(
    await refusal(
      await target.write('/api/admin/backups/finish', {
        backupId,
        manifestSha256: null,
      }),
      503,
    ),
    'MAINTENANCE',
  )
  const resumed = await json(
    await target.write('/api/admin/operations/resume', {
      expectedGeneration: restored.publicGeneration,
    }),
    200,
    resumeSchema,
  )
  equal(resumed.state, 'writable')
  equal(
    (await json(await target.fetch('/api/admin/operations'), 200, operationsSchema))
      .maintenance,
    0,
  )
  await json(await target.write('/api/admin/documents', {}), 201)
}

async function publishWithMedia(
  context: Runtime,
): Promise<{ path: string, assetId: string }> {
  const tag = await json(
    await context.write('/api/admin/catalog/tag', { slug: 'restored', name: 'Restored' }),
    201,
    catalogItemSchema,
  )
  const ready = await uploadFile(context, 'restore.txt', mediaBytes)
  const created = await json(
    await context.write('/api/admin/documents', {}),
    201,
    acknowledgementSchema,
  )
  const current = await json(
    await context.fetch(`/api/admin/documents/${created.documentId}`),
    200,
    openDocumentSchema,
  )
  const doc = current.document
  doc.meta.title = 'Restorable post'
  doc.meta.slug = 'restorable-post'
  doc.meta.description = 'Restored from a frozen backup'
  doc.meta.tags = [
    {
      id: tag.id,
      slug: tag.slug,
      label: tag.name,
    },
  ]
  attachFile(doc, ready)
  const saved = await json(
    await context.write(
      `/api/admin/documents/${created.documentId}/revisions`,
      {
        expectedVersion: current.version,
        baseRevisionId: current.headRevisionId,
        reason: 'manual',
        document: doc,
      },
      'PUT',
    ),
    200,
    acknowledgementSchema,
  )
  await json(
    await context.write(`/api/admin/documents/${created.documentId}/publish`, {
      expectedVersion: saved.version,
      expectedLiveGeneration: saved.liveGeneration,
      revisionId: saved.headRevisionId,
    }),
    200,
    acknowledgementSchema,
  )
  return { path: 'posts/restorable-post', assetId: ready.assetId }
}

function attachFile(
  doc: Awaited<ReturnType<typeof openDocumentSchema.parse>>['document'],
  ready: StoredMedia,
): void {
  const id = crypto.randomUUID()
  doc.blocks.push({
    id,
    type: 'file',
    props: {
      name: 'Restorable media payload',
      caption: 'Download',
      backgroundColor: 'default',
      url: `/assets/${ready.assetId}`,
    },
    children: [],
  })
  doc.mediaAccessibility[id] = {
    alt: '',
    decorative: false,
    transcript: '',
    captionAssetId: null,
    posterAssetId: null,
  }
}
