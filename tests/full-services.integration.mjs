import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { AssetGC } from '../src/server/asset-gc.ts'
import { ScheduleRepository } from '../src/server/schedules.ts'
import { runtime } from './runtime.mjs'

async function json(response, status = 200) {
  assert.equal(response.status, status, await response.clone().text())
  return await response.json()
}
async function upload(context, options = {}) {
  const bytes = options.bytes ?? Buffer.from('A media document')
  const input = {
    filename: 'document.txt',
    role: 'file',
    type: 'text/plain',
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    ...options.descriptor,
  }
  const allocation = await json(await context.write('/api/admin/assets', input), 201)
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
async function publishedFile(context) {
  const asset = await upload(context)
  const ready = await json(asset.response)
  const created = await json(await context.write('/api/admin/documents', {}), 201)
  const current = await json(
    await context.fetch(`/api/admin/documents/${created.documentId}`),
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
void test('streaming media gates readiness, live membership, Range and history retention', async () => {
  const context = await runtime()
  try {
    const data = await publishedFile(context)
    assert.equal((await context.fetch(data.ready.url)).status, 404)
    await json(
      await context.write(`/api/admin/documents/${data.created.documentId}/publish`, {
        expectedVersion: data.saved.version,
        expectedLiveGeneration: data.saved.liveGeneration,
        revisionId: data.saved.headRevisionId,
      }),
    )
    const ranged = await context.fetch(data.ready.url, { headers: { range: 'bytes=0-3' } })
    assert.equal(ranged.status, 206)
    assert.equal(await ranged.text(), 'A me')
    const multiple = await context.fetch(data.ready.url, {
      headers: { range: 'bytes=0-1,3-4' },
    })
    assert.equal(multiple.status, 416)
    assert.equal(
      (
        await context.fetch(data.ready.url, {
          headers: { 'if-none-match': `"${data.ready.sha256}"` },
        })
      ).status,
      304,
    )
    const file = await context.fetch(data.ready.url)
    assert.equal(file.headers.get('content-disposition').startsWith('attachment'), true)
    assert.equal(file.headers.get('content-security-policy').includes('sandbox'), true)
    const bad = await upload(context, { descriptor: { sha256: '0'.repeat(64) } })
    assert.equal(bad.response.status, 422)
    assert.equal(
      (await json(await context.fetch(`/api/admin/assets/${bad.allocation.assetId}`))).state,
      'rejected',
    )
    const detached = await upload(context)
    await json(detached.response)
    await new AssetGC(context.db).collect(context.media, Date.now() + 86500000)
    assert.equal(
      (await json(await context.fetch(`/api/admin/assets/${detached.allocation.assetId}`)))
        .state,
      'deleted',
    )
    assert.equal(
      (await json(await context.fetch(`/api/admin/assets/${data.ready.assetId}`))).state,
      'ready',
    )
  }
  finally {
    await context.dispose()
  }
})
void test('catalog snapshots, schedules and due publication use atomic live projection', async () => {
  const context = await runtime()
  try {
    const data = await publishedFile(context)
    await catalogFlow(context, data)
    await scheduleFlow(context, data)
  }
  finally {
    await context.dispose()
  }
})
async function catalogFlow(context, data) {
  const tag = await json(
    await context.write('/api/admin/catalog/tag', { slug: 'systems', name: 'Systems' }),
    201,
  )
  const current = await json(
    await context.fetch(`/api/admin/documents/${data.created.documentId}`),
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
  )
  assert.equal((await context.fetch('/tags/systems')).status, 200)
  assert.equal((await context.fetch('/tags/renamed')).status, 404)
  assert.equal((await context.fetch('/rss.xml')).status, 200)
  assert.equal((await context.fetch('/sitemap.xml')).status, 200)
}
async function scheduleFlow(context, data) {
  const current = await json(
    await context.fetch(`/api/admin/documents/${data.created.documentId}`),
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
  )
  assert.equal(scheduled.version, current.version + 1)
  const jobs = new ScheduleRepository(context.db)
  assert.equal(await jobs.runDue(runAt + 1), 1)
  assert.equal(await jobs.runDue(runAt + 1), 0)
  const live = await json(await context.fetch(`/api/admin/documents/${current.documentId}`))
  assert.equal(live.liveGeneration, current.liveGeneration + 1)
  assert.equal(live.liveRevisionId, current.headRevisionId)
}
