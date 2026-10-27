import type { Document } from '@/content/document'
import type { Runtime } from '~/tests/support/worker/runtime'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { openDocumentSchema } from '@/contracts/documents'
import { assetAllocationSchema } from '@/contracts/media'
import { AssetGC } from '@/server/media/asset-gc'
import { equal } from '~/tests/support/unit/assertions'
import { json, refusal } from '~/tests/support/worker/responses'
import { runtime } from '~/tests/support/worker/runtime'

// A 1x1 PNG. The upload inspector checks the signature, IHDR and IEND, so a real
// image file is needed even though the homepage only uses a fixed cover ratio.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

async function uploadImage(context: Runtime, filename: string): Promise<string> {
  const input = {
    filename,
    role: 'image' as const,
    type: 'image/png',
    bytes: PNG.length,
    sha256: createHash('sha256').update(PNG).digest('hex'),
  }
  const allocation = await json(
    await context.write('/api/admin/assets', input),
    201,
    assetAllocationSchema,
  )
  const response = await context.fetch(allocation.uploadPath, {
    method: 'PUT',
    headers: {
      'origin': context.origin,
      'x-csrf-token': context.csrfToken,
      'content-type': input.type,
      'content-length': String(PNG.length),
    },
    body: PNG,
  })
  equal(response.status, 200, await response.clone().text())
  return allocation.assetId
}

async function createArticle(context: Runtime, title: string, slug: string) {
  const created = await json(await context.write('/api/admin/documents', {}), 201)
  const opened = await open(context, created.documentId)
  opened.document.meta.title = title
  opened.document.meta.slug = slug
  return { id: created.documentId, opened }
}

async function open(context: Runtime, id: string) {
  return await json(
    await context.fetch(`/api/admin/documents/${id}`),
    200,
    openDocumentSchema,
  )
}

async function save(context: Runtime, current: Awaited<ReturnType<typeof open>>, document: Document) {
  return await json(
    await context.write(
      `/api/admin/documents/${current.documentId}/revisions`,
      {
        expectedVersion: current.version,
        baseRevisionId: current.headRevisionId,
        reason: 'manual',
        document,
      },
      'PUT',
    ),
  )
}

async function publish(
  context: Runtime,
  acknowledgement: Awaited<ReturnType<typeof save>>,
  documentId: string,
) {
  return await json(
    await context.write(`/api/admin/documents/${documentId}/publish`, {
      expectedVersion: acknowledgement.version,
      expectedLiveGeneration: acknowledgement.liveGeneration,
      revisionId: acknowledgement.headRevisionId,
    }),
  )
}

async function homepage(context: Runtime): Promise<string> {
  const response = await context.fetch('/')
  equal(response.status, 200)
  return await response.text()
}

function homeCard(html: string, title: string): string {
  const cards = html.match(/<li[^>]*data-feed-item[^>]*>[\s\S]*?<\/li>/g) ?? []
  const matches = cards.filter(card => card.includes(`>${title}<`))
  equal(matches.length, 1)
  return matches[0] ?? ''
}

async function assetState(context: Runtime, id: string): Promise<string> {
  const row = await context.db
    .prepare('SELECT state FROM assets WHERE id=?')
    .bind(id)
    .first<{ state: string }>()
  return row?.state ?? 'missing'
}

/*
 * The live homepage is the public surface: only the published projection may
 * name a cover, the asset route and GC see the cover as a live reference, and a
 * head-only cover stays invisible until publication.
 */
test('built Worker: home feed covers follow publication, survive GC and refuse unavailable media', async (t) => {
  const app = await runtime()
  t.after(async () => await app.dispose())
  await legacyFeed(app)
  const cover = await publishCover(app)
  await headIsolation(app, cover)
  await clearCover(app, cover.id)
  await unavailableCover(app)
}).catch((error: unknown) => { throw error })

// An article written before covers existed has no cover key and must publish.
async function legacyFeed(app: Runtime): Promise<void> {
  const legacy = await createArticle(app, 'Legacy feed card', 'legacy-feed-card')
  const saved = await save(app, legacy.opened, legacy.opened.document)
  await publish(app, saved, legacy.id)
  const card = homeCard(await homepage(app), 'Legacy feed card')
  assert.ok(card.includes('href="/posts/legacy-feed-card"'))
  assert.ok(!card.includes('<img'))
}

async function publishCover(app: Runtime): Promise<{ id: string, coverA: string }> {
  const covered = await createArticle(app, 'Covered feed card', 'covered-feed-card')
  const coverA = await uploadImage(app, 'cover-a.png')
  covered.opened.document.meta.cover = {
    assetId: coverA,
    alt: 'Desk at dusk',
  }
  const saved = await save(app, covered.opened, covered.opened.document)
  // A head cover is not public and its asset is not served yet.
  equal((await app.fetch(`/assets/${coverA}`)).status, 404)
  await publish(app, saved, covered.id)

  const card = homeCard(await homepage(app), 'Covered feed card')
  assert.ok(card.includes(`src="/assets/${coverA}"`))
  assert.ok(card.includes('alt="Desk at dusk"'))
  assert.ok(card.includes('loading="lazy"'))
  assert.ok(card.includes('width="960"') && card.includes('height="640"'))
  equal((await app.fetch(`/assets/${coverA}`)).status, 200)
  equal(await liveImageReferences(app, coverA), 1)

  // The cover is retained by its live revision while an unrelated asset is collected.
  const detached = await uploadImage(app, 'detached.png')
  await app.db.prepare('UPDATE assets SET gc_after=0 WHERE id IN (?,?)').bind(coverA, detached).run()
  await new AssetGC(app.db).collect(app.media, Date.now() + 86500000)
  equal(await assetState(app, coverA), 'ready')
  equal(await assetState(app, detached), 'deleted')
  return { id: covered.id, coverA }
}

async function liveImageReferences(app: Runtime, assetId: string): Promise<number> {
  return (
    await app.db
      .prepare(
        `SELECT COUNT(*) AS n FROM revision_assets ra JOIN documents d
        ON d.live_revision_id=ra.revision_id WHERE ra.asset_id=? AND ra.role='image'`,
      )
      .bind(assetId)
      .first<{ n: number }>()
  )?.n ?? 0
}

// A newer head revision does not touch the live card until it is published.
async function headIsolation(app: Runtime, cover: { id: string, coverA: string }): Promise<void> {
  const coverB = await uploadImage(app, 'cover-b.png')
  const head = await open(app, cover.id)
  head.document.meta.cover = {
    assetId: coverB,
    alt: 'Morning light',
  }
  const saved = await save(app, head, head.document)
  const stillLive = await homepage(app)
  const card = homeCard(stillLive, 'Covered feed card')
  assert.ok(card.includes(`src="/assets/${cover.coverA}"`))
  assert.ok(card.includes('alt="Desk at dusk"'))
  assert.ok(!stillLive.includes(`/assets/${coverB}`))
  equal((await app.fetch(`/assets/${coverB}`)).status, 404)

  await publish(app, saved, cover.id)
  const updated = homeCard(await homepage(app), 'Covered feed card')
  assert.ok(updated.includes(`src="/assets/${coverB}"`))
  assert.ok(updated.includes('alt="Morning light"'))
}

// Clearing the cover is saved canonically and removes the image from the card.
async function clearCover(app: Runtime, id: string): Promise<void> {
  const cleared = await open(app, id)
  cleared.document.meta.cover = null
  const saved = await save(app, cleared, cleared.document)
  equal((await open(app, id)).document.meta.cover, null)
  await publish(app, saved, id)
  assert.ok(!homeCard(await homepage(app), 'Covered feed card').includes('<img'))
}

// A selected asset that is still uploading is refused at the write that
// publication would use, so no invalid revision or live card can exist.
async function unavailableCover(app: Runtime): Promise<void> {
  const unavailable = await createArticle(app, 'Unavailable cover card', 'unavailable-cover-card')
  const uploading = await json(
    await app.write('/api/admin/assets', {
      filename: 'unready.png',
      role: 'image',
      type: 'image/png',
      bytes: PNG.length,
      sha256: createHash('sha256').update(PNG).digest('hex'),
    }),
    201,
    assetAllocationSchema,
  )
  unavailable.opened.document.meta.cover = {
    assetId: uploading.assetId,
    alt: '',
  }
  equal(
    await refusal(
      await app.write(
        `/api/admin/documents/${unavailable.id}/revisions`,
        {
          expectedVersion: unavailable.opened.version,
          baseRevisionId: unavailable.opened.headRevisionId,
          reason: 'manual',
          document: unavailable.opened.document,
        },
        'PUT',
      ),
      422,
    ),
    'ASSET_NOT_READY',
  )
  equal((await open(app, unavailable.id)).liveRevisionId, null)
  equal((await app.fetch('/posts/unavailable-cover-card')).status, 404)
}
