import type { allocateAssetSchema } from '@/contracts/media'
import type { Runtime } from '~/tests/support/worker/runtime'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { catalogItemSchema } from '@/contracts/catalog'
import { openDocumentSchema } from '@/contracts/documents'
import { assetAllocationSchema, assetDescriptorSchema } from '@/contracts/media'
import { scheduleAckSchema } from '@/contracts/publication'
import { AssetGC } from '@/server/media/asset-gc'
import { ScheduleRepository } from '@/server/publication/schedules'
import { equal } from '~/tests/support/unit/assertions'
import { json } from '~/tests/support/worker/responses'
import { runtime } from '~/tests/support/worker/runtime'

async function upload(
  context: Runtime,
  options: { bytes?: Buffer, descriptor?: Partial<ReturnType<typeof allocateAssetSchema.parse>> } = {},
) {
  const bytes = options.bytes ?? Buffer.from('A media document')
  const input = {
    filename: 'document.txt',
    role: 'file' as const,
    type: 'text/plain',
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    ...options.descriptor,
  }
  const allocation = await json(await context.write('/api/admin/assets', input), 201, assetAllocationSchema)
  const response = await context.fetch(allocation.uploadPath, {
    method: 'PUT',
    headers: {
      'origin': context.origin,
      'x-csrf-token': context.csrfToken,
      'content-type': input.type,
      'content-length': String(bytes.length),
    },
    body: bytes,
  })
  return { allocation, response, input, bytes }
}
async function publishedFile(context: Runtime) {
  const asset = await upload(context)
  const ready = await json(asset.response, 200, assetDescriptorSchema)
  const created = await json(await context.write('/api/admin/documents', {}), 201)
  const current = await json(
    await context.fetch(`/api/admin/documents/${created.documentId}`),
    200,
    openDocumentSchema,
  )
  const doc = current.document
  doc.meta.title = 'Full service post'
  doc.meta.slug = 'full-service'
  const id = crypto.randomUUID()
  doc.blocks.push({
    id,
    type: 'file',
    props: {
      name: 'document.txt',
      caption: 'Download',
      backgroundColor: 'default',
      url: ready.url,
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
  )
  return { created, saved, ready, document: doc }
}
test('streaming media gates readiness, live membership, Range and history retention', async () => {
  const context = await runtime()
  try {
    const data = await publishedFile(context)
    equal((await context.fetch(data.ready.url)).status, 404)
    await json(
      await context.write(`/api/admin/documents/${data.created.documentId}/publish`, {
        expectedVersion: data.saved.version,
        expectedLiveGeneration: data.saved.liveGeneration,
        revisionId: data.saved.headRevisionId,
      }),
    )
    const ranged = await context.fetch(data.ready.url, { headers: { range: 'bytes=0-3' } })
    equal(ranged.status, 206)
    equal(await ranged.text(), 'A me')
    const multiple = await context.fetch(data.ready.url, {
      headers: { range: 'bytes=0-1,3-4' },
    })
    equal(multiple.status, 416)
    equal(
      (
        await context.fetch(data.ready.url, {
          headers: { 'if-none-match': `"${data.ready.sha256}"` },
        })
      ).status,
      304,
    )
    const file = await context.fetch(data.ready.url)
    equal(file.headers.get('content-disposition')?.startsWith('attachment'), true)
    equal(file.headers.get('content-security-policy')?.includes('sandbox'), true)
    const bad = await upload(context, { descriptor: { sha256: '0'.repeat(64) } })
    equal(bad.response.status, 422)
    equal(
      (await json(
        await context.fetch(`/api/admin/assets/${bad.allocation.assetId}`),
        200,
        assetDescriptorSchema,
      )).state,
      'rejected',
    )
    const detached = await upload(context)
    await json(detached.response, 200, assetDescriptorSchema)
    await new AssetGC(context.db).collect(context.media, Date.now() + 86500000)
    equal(
      (await json(await context.fetch(`/api/admin/assets/${detached.allocation.assetId}`), 200, assetDescriptorSchema))
        .state,
      'deleted',
    )
    equal(
      (await json(await context.fetch(`/api/admin/assets/${data.ready.assetId}`), 200, assetDescriptorSchema)).state,
      'ready',
    )
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })
test('catalog snapshots, schedules and due publication use atomic live projection', async () => {
  const context = await runtime()
  try {
    const data = await publishedFile(context)
    await catalogFlow(context, data)
    await scheduleFlow(context, data)
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })
async function catalogFlow(context: Runtime, data: Awaited<ReturnType<typeof publishedFile>>) {
  const tag = await json(
    await context.write('/api/admin/catalog/tag', { slug: 'systems', name: 'Systems' }),
    201,
    catalogItemSchema,
  )
  const current = await json(
    await context.fetch(`/api/admin/documents/${data.created.documentId}`),
    200,
    openDocumentSchema,
  )
  current.document.meta.tags = [
    { id: tag.id, slug: tag.slug, label: tag.name },
  ]
  const saved = await json(
    await context.write(
      `/api/admin/documents/${current.documentId}/revisions`,
      {
        expectedVersion: current.version,
        baseRevisionId: current.headRevisionId,
        reason: 'manual',
        document: current.document,
      },
      'PUT',
    ),
  )
  await json(
    await context.write(`/api/admin/documents/${current.documentId}/publish`, {
      expectedVersion: saved.version,
      expectedLiveGeneration: saved.liveGeneration,
      revisionId: saved.headRevisionId,
    }),
  )
  await json(
    await context.write(
      `/api/admin/catalog/tag/${tag.id}`,
      { expectedVersion: tag.version, slug: 'renamed', name: 'Renamed', retired: true },
      'PUT',
    ),
    200,
    catalogItemSchema,
  )
  equal((await context.fetch('/tags/systems')).status, 200)
  equal((await context.fetch('/tags/renamed')).status, 404)
  equal((await context.fetch('/rss.xml')).status, 200)
  equal((await context.fetch('/sitemap.xml')).status, 200)
}
async function scheduleFlow(context: Runtime, data: Awaited<ReturnType<typeof publishedFile>>) {
  const current = await json(
    await context.fetch(`/api/admin/documents/${data.created.documentId}`),
    200,
    openDocumentSchema,
  )
  const runAt = Math.ceil((Date.now() + 120000) / 60000) * 60000
  const scheduled = await json(
    await context.write(`/api/admin/documents/${current.documentId}/schedules`, {
      expectedVersion: current.version,
      expectedLiveGeneration: current.liveGeneration,
      revisionId: current.headRevisionId,
      runAt,
      localTime: new Date(runAt).toISOString().slice(0, 16),
      timezone: 'UTC',
      utcOffset: 0,
    }),
    201,
    scheduleAckSchema,
  )
  equal(scheduled.version, current.version + 1)
  const jobs = new ScheduleRepository(context.db)
  equal(await jobs.runDue(runAt + 1), 1)
  equal(await jobs.runDue(runAt + 1), 0)
  const live = await json(await context.fetch(`/api/admin/documents/${current.documentId}`), 200, openDocumentSchema)
  equal(live.liveGeneration, current.liveGeneration + 1)
  equal(live.liveRevisionId, current.headRevisionId)
}
