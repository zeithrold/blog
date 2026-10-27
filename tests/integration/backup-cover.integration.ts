import type { Exported } from '~/tests/support/worker/backups'
import type { Runtime } from '~/tests/support/worker/runtime'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { acknowledgementSchema, openDocumentSchema } from '@/contracts/documents'
import { assetAllocationSchema, assetDescriptorSchema } from '@/contracts/media'
import { operationsSchema } from '@/contracts/operations'
import { freezeSchema, releaseSchema } from '@/server/operations/operations'
import { deepEqual, equal } from '~/tests/support/unit/assertions'
import { copyMedia, exportTable, restoreDatabase, restoreOrder } from '~/tests/support/worker/backups'
import { json } from '~/tests/support/worker/responses'
import { runtime } from '~/tests/support/worker/runtime'

const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
)

test('backup restores the live homepage cover independently of a newer uncovered draft', async () => {
  const source = await runtime()
  const target = await runtime()
  try {
    const assetId = await uploadCover(source)
    const id = await publishCover(source, assetId)
    const backup = await json(
      await source.write('/api/admin/backups/freeze', {}),
      201,
      freezeSchema,
    )
    const exported: Exported = new Map()
    for (const table of restoreOrder) {
      exported.set(table, await exportTable(source, backup.backupId, table))
    }
    await restoreDatabase(target, exported)
    equal(await copyMedia(source, target, backup.backupId), 1)

    const homepage = await target.fetch('/')
    equal(homepage.status, 200)
    equal(new RegExp(`<img[^>]+src="/assets/${assetId}"`).test(await homepage.text()), true)
    const media = await target.fetch(`/assets/${assetId}`)
    equal(media.status, 200)
    deepEqual(Buffer.from(await media.arrayBuffer()), image)
    const draft = await json(
      await target.fetch(`/api/admin/documents/${id}`),
      200,
      openDocumentSchema,
    )
    equal(draft.document.meta.cover, null)
    await releaseSource(source, backup.backupId)
    const restoredHealth = await json(
      await target.fetch('/api/admin/operations'),
      200,
      operationsSchema,
    )
    equal(restoredHealth.maintenance, 1)
    equal(restoredHealth.maintenanceOwner, null)
  }
  finally {
    await source.dispose()
    await target.dispose()
  }
}).catch((error: unknown) => { throw error })

async function releaseSource(context: Runtime, backupId: string): Promise<void> {
  const manifest = await context.fetch(`/api/admin/backups/${backupId}/manifest?after=`)
  equal(manifest.status, 200)
  const manifestSha256 = createHash('sha256').update(await manifest.text()).digest('hex')
  const complete = await json(
    await context.write('/api/admin/backups/finish', { backupId, manifestSha256 }),
    200,
    releaseSchema,
  )
  equal(complete.state, 'complete')
  const next = await json(
    await context.write('/api/admin/backups/freeze', {}),
    201,
    freezeSchema,
  )
  const failed = await json(
    await context.write('/api/admin/backups/finish', {
      backupId: next.backupId,
      manifestSha256: null,
    }),
    200,
    releaseSchema,
  )
  equal(failed.state, 'failed')
  await json(await context.write('/api/admin/documents', {}), 201, acknowledgementSchema)
}

async function uploadCover(context: Runtime): Promise<string> {
  const allocation = await json(
    await context.write('/api/admin/assets', {
      filename: 'restore-cover.png',
      role: 'image',
      type: 'image/png',
      bytes: image.length,
      sha256: createHash('sha256').update(image).digest('hex'),
    }),
    201,
    assetAllocationSchema,
  )
  await json(
    await context.fetch(allocation.uploadPath, {
      method: 'PUT',
      headers: {
        'origin': context.origin,
        'x-csrf-token': context.csrfToken,
        'content-type': 'image/png',
        'content-length': String(image.length),
      },
      body: image,
    }),
    200,
    assetDescriptorSchema,
  )
  return allocation.assetId
}

async function publishCover(context: Runtime, assetId: string): Promise<string> {
  const created = await json(
    await context.write('/api/admin/documents', {}),
    201,
    acknowledgementSchema,
  )
  const path = `/api/admin/documents/${created.documentId}`
  const opened = await json(await context.fetch(path), 200, openDocumentSchema)
  opened.document.meta.title = 'Restored homepage cover'
  opened.document.meta.slug = 'restored-homepage-cover'
  opened.document.meta.cover = { assetId, alt: 'Restorable cover' }
  const saved = await json(
    await context.write(`${path}/revisions`, {
      expectedVersion: opened.version,
      baseRevisionId: opened.headRevisionId,
      reason: 'manual',
      document: opened.document,
    }, 'PUT'),
    200,
    acknowledgementSchema,
  )
  const published = await json(
    await context.write(`${path}/publish`, {
      expectedVersion: saved.version,
      expectedLiveGeneration: saved.liveGeneration,
      revisionId: saved.headRevisionId,
    }),
    200,
    acknowledgementSchema,
  )
  opened.document.meta.cover = null
  await json(
    await context.write(`${path}/revisions`, {
      expectedVersion: published.version,
      baseRevisionId: published.headRevisionId,
      reason: 'manual',
      document: opened.document,
    }, 'PUT'),
    200,
    acknowledgementSchema,
  )
  return created.documentId
}
