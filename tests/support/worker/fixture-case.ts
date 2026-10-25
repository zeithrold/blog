import type { Write } from './fixture-gateway'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { documentListSchema, openDocumentSchema } from '@/contracts/documents'
import { assetAllocationSchema, assetDescriptorSchema, assetListSchema } from '@/contracts/media'
import { scheduleAckSchema } from '@/contracts/publication'
import { sessionSchema } from '@/contracts/session'
import { equal } from '~/tests/support/unit/assertions'
import { call, health, search, session, status, writer } from './fixture-gateway'
import { json } from './responses'

export type Seeded = {
  csrfToken: string
  documentId: string
  assetId: string
  assetPath: string
  replayKey: string
  keyedDocumentId: string
}
type Media = { assetId: string, url: string }

// The quota guard allows 256 MiB of declared media per 24 hours, so four full-sized videos
// exhaust it once the case already holds one small asset.
const quotaAsset = {
  filename: 'isolation.mp4',
  role: 'video' as const,
  type: 'video/mp4',
  bytes: 64 * 1024 * 1024,
  sha256: '0'.repeat(64),
}

// The smallest durable write, for tests that only need to prove state did not survive a reset.
export async function probe(origin: string): Promise<string> {
  const write = writer(origin, await session(origin))
  const created = await json(await write('/api/admin/documents', { kind: 'page' }), 201)
  return created.documentId
}

// One case of every kind of durable state a test can create, all through the public API.
export async function seed(origin: string): Promise<Seeded> {
  const csrfToken = await session(origin)
  const write = writer(origin, csrfToken)
  const asset = await uploadMedia(origin, write, csrfToken)
  const documentId = await draftAndPublish(origin, write, asset.url)
  await schedulePublish(origin, write, documentId)
  const replayKey = crypto.randomUUID()
  const keyedDocumentId = await replayProbe(write, replayKey)
  await exhaustQuota(write)
  equal(
    await status(await call(origin, '/__fixture/scenario', { method: 'POST', body: 'maintenance' })),
    204,
  )
  await verifyLiveCase(origin, asset, documentId)
  return {
    csrfToken,
    documentId,
    assetId: asset.assetId,
    assetPath: asset.url,
    replayKey,
    keyedDocumentId,
  }
}

async function uploadMedia(origin: string, write: Write, csrfToken: string): Promise<Media> {
  const bytes = Buffer.from('fixture isolation media')
  const allocation = await json(
    await write('/api/admin/assets', {
      filename: 'isolation.txt',
      role: 'file',
      type: 'text/plain',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }),
    201,
    assetAllocationSchema,
  )
  const asset = await json(
    await call(origin, allocation.uploadPath, {
      method: 'PUT',
      headers: {
        'content-type': 'text/plain',
        'origin': origin,
        'x-csrf-token': csrfToken,
      },
      body: bytes,
    }),
    200,
    assetDescriptorSchema,
  )
  return { assetId: asset.assetId, url: asset.url }
}

async function draftAndPublish(origin: string, write: Write, assetUrl: string): Promise<string> {
  const created = await json(await write('/api/admin/documents', { kind: 'article' }), 201)
  const current = await json(
    await call(origin, `/api/admin/documents/${created.documentId}`),
    200,
    openDocumentSchema,
  )
  const blockId = crypto.randomUUID()
  current.document.meta.title = 'Isolation probe'
  current.document.meta.slug = 'isolation-probe'
  current.document.blocks.push({
    id: blockId,
    type: 'file',
    props: {
      name: 'isolation.txt',
      caption: 'Isolation probe',
      backgroundColor: 'default',
      url: assetUrl,
    },
    children: [],
  })
  current.document.mediaAccessibility[blockId] = {
    alt: '',
    decorative: false,
    transcript: '',
    captionAssetId: null,
    posterAssetId: null,
  }
  await save(write, created.documentId, current)
  const saved = await json(
    await call(origin, `/api/admin/documents/${created.documentId}`),
    200,
    openDocumentSchema,
  )
  await json(
    await write(`/api/admin/documents/${created.documentId}/publish`, {
      expectedVersion: saved.version,
      expectedLiveGeneration: saved.liveGeneration,
      revisionId: saved.headRevisionId,
    }),
    200,
  )
  return created.documentId
}

async function save(
  write: Write,
  documentId: string,
  current: Awaited<ReturnType<typeof openDocumentSchema.parse>>,
): Promise<void> {
  await json(
    await write(
      `/api/admin/documents/${documentId}/revisions`,
      {
        expectedVersion: current.version,
        baseRevisionId: current.headRevisionId,
        reason: 'manual',
        document: current.document,
      },
      'PUT',
    ),
    200,
  )
}

async function schedulePublish(origin: string, write: Write, documentId: string): Promise<void> {
  const current = await json(
    await call(origin, `/api/admin/documents/${documentId}`),
    200,
    openDocumentSchema,
  )
  const runAt = Math.ceil((Date.now() + 120000) / 60000) * 60000
  await json(
    await write(`/api/admin/documents/${documentId}/schedules`, {
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
}

async function replayProbe(write: Write, replayKey: string): Promise<string> {
  const keyed = await json(
    await write('/api/admin/documents', { kind: 'page' }, 'POST', replayKey),
    201,
  )
  const replay = await json(
    await write('/api/admin/documents', { kind: 'page' }, 'POST', replayKey),
    201,
  )
  equal(replay.documentId, keyed.documentId, 'an idempotency key replays inside one case')
  return keyed.documentId
}

async function exhaustQuota(write: Write): Promise<void> {
  for (let index = 0; index < 3; index++) {
    await json(await write('/api/admin/assets', quotaAsset), 201, assetAllocationSchema)
  }
  const exhausted = await write('/api/admin/assets', quotaAsset)
  equal(exhausted.status, 429, await exhausted.clone().text())
}

async function verifyLiveCase(origin: string, asset: Media, documentId: string): Promise<void> {
  const busy = await health(origin)
  equal(busy.documents, 2)
  equal(busy.readyAssets, 1)
  equal(busy.searchableDocuments, 1)
  equal(busy.pendingSchedules, 1)
  equal(busy.maintenance, 1)
  equal(busy.publicGeneration, 1)
  assert.ok(busy.assetBytes > 0)
  equal(await status(await call(origin, '/posts/isolation-probe', { anonymous: true })), 200)
  equal(await status(await call(origin, asset.url, { anonymous: true })), 200)
  const found = await search(origin, 'Isolation')
  equal(found.items.length, 1)
  equal(found.items[0]?.path, '/posts/isolation-probe')
  equal(await status(await call(origin, `/api/admin/documents/${documentId}`)), 200)
}

// Everything the previous case wrote must be gone, including live, search, history and storage.
export async function clean(origin: string, seeded: Seeded): Promise<void> {
  const state = await health(origin)
  equal(state.documents, 0, 'documents')
  equal(state.revisions, 0, 'revisions')
  equal(state.readyAssets, 0, 'assets')
  equal(state.assetBytes, 0, 'asset bytes')
  equal(state.searchableDocuments, 0, 'search index')
  equal(state.pendingSchedules, 0, 'schedules')
  equal(state.failedSchedules, 0, 'failed schedules')
  equal(state.contentBytes, 0, 'content bytes')
  equal(state.publicGeneration, 0, 'live generation')
  equal(state.maintenance, 0, 'maintenance')
  equal(state.maintenanceSince, null, 'maintenance start')
  equal(state.maintenanceOwner, null, 'maintenance owner')
  equal(state.lastBackupAt, null, 'backup state')
  equal((await json(await call(origin, '/api/admin/documents'), 200, documentListSchema)).items.length, 0)
  equal(await status(await call(origin, `/api/admin/documents/${seeded.documentId}`)), 404)
  equal(await status(await call(origin, `/api/admin/documents/${seeded.documentId}/revisions`)), 404)
  equal(await status(await call(origin, `/api/admin/documents/${seeded.documentId}/schedules`)), 404)
  equal((await json(await call(origin, '/api/admin/assets'), 200, assetListSchema)).items.length, 0)
  equal(await status(await call(origin, `/api/admin/assets/${seeded.assetId}`)), 404)
  // The published asset and post were public inside the case and must not survive it.
  equal(await status(await call(origin, seeded.assetPath, { anonymous: true })), 404)
  equal(await status(await call(origin, '/posts/isolation-probe', { anonymous: true })), 404)
  const nothing = await search(origin, 'Isolation')
  equal(nothing.items.length, 0)
  equal(nothing.nextOffset, null)
}

// Mutation journals, quotas and authentication material must start over as well.
export async function nextCase(origin: string, seeded: Seeded): Promise<void> {
  const body = await json(await call(origin, '/api/admin/session'), 200, sessionSchema)
  const write = writer(origin, body.csrfToken)
  await clean(origin, seeded)
  const created = await json(
    await write('/api/admin/documents', { kind: 'page' }, 'POST', seeded.replayKey),
    201,
  )
  assert.notEqual(
    created.documentId,
    seeded.keyedDocumentId,
    'an idempotency key from the previous case must not replay',
  )
  await json(await write('/api/admin/assets', quotaAsset), 201, assetAllocationSchema)
  const stale = await call(origin, '/api/admin/documents', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': origin,
      'x-csrf-token': seeded.csrfToken,
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ kind: 'page' }),
  })
  equal(await status(stale), 403, 'a token minted for the previous case must not authorize this one')
}
