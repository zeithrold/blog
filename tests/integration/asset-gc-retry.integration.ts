import type { R2Bucket } from '@cloudflare/workers-types/index.ts'
import type { Runtime } from '~/tests/support/worker/runtime'
import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import { AssetGC } from '@/server/media/asset-gc'
import { equal } from '~/tests/support/unit/assertions'
import { runtime } from '~/tests/support/worker/runtime'
import { uploadFile } from '~/tests/support/worker/uploads'

type ObjectBucket = Pick<R2Bucket, 'delete'>
type Asset = { id: string, key: string }

/**
 * A media object whose deletion keeps failing must not hold the head of the
 * collection order forever. Ten poisoned objects sit ahead of three healthy ones
 * in one due batch; the next batch still has to compact the healthy objects.
 */
const body = Buffer.from('body')
const poisonedCount = 10
const healthyCount = 3
const firstRetryMs = AssetGC.retryBaseMs * 2

test('media collection retries failing objects without starving later objects', async () => {
  const context = await runtime()
  try {
    const poisoned: Asset[] = []
    const healthy: Asset[] = []
    for (let index = 0; index < poisonedCount + healthyCount; index++) {
      const stored = await uploadFile(context, `object-${index}.txt`, body)
      const asset = { id: stored.assetId, key: stored.objectKey }
      const ahead = index < poisonedCount
      if (ahead) {
        poisoned.push(asset)
      }
      else {
        healthy.push(asset)
      }
      // The collector takes the ten oldest due objects, so the poisoned group is
      // placed strictly ahead of the healthy one.
      await dueAt(context, asset.id, (ahead ? 1000 : 2000) + index)
    }
    const failing = failingBucket(context.media, new Set(poisoned.map(asset => asset.key)))
    const now = Date.now()
    equal(await new AssetGC(context.db).collect(failing, now), 0)
    equal(await new AssetGC(context.db).collect(failing, now), healthyCount)
    await assertHealthyCollected(context, healthy)
    await assertPoisonedRetried(context, poisoned, now)
    // Once the bucket recovers the deferred objects are collected, so the backoff
    // delays cleanup instead of abandoning it.
    equal(await new AssetGC(context.db).collect(context.media, now + firstRetryMs), poisonedCount)
    for (const asset of poisoned) {
      equal(await context.media.get(asset.key), null)
      equal(await state(context, asset.id), 'deleted')
    }
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })

async function assertHealthyCollected(context: Runtime, healthy: Asset[]): Promise<void> {
  for (const asset of healthy) {
    equal(await context.media.get(asset.key), null)
    equal(await state(context, asset.id), 'deleted')
  }
}

async function assertPoisonedRetried(
  context: Runtime,
  poisoned: Asset[],
  now: number,
): Promise<void> {
  for (const asset of poisoned) {
    equal((await context.media.get(asset.key)) !== null, true)
    // The failed claim left the row in flight; it is not collected either.
    equal(await state(context, asset.id), 'deleting')
    // The failure is retried in bounded backoff: attempts counted, the retry
    // inside a day, and the object no longer at the head of the next batch.
    const retry = await retryOf(context, asset.id)
    equal(retry.attempts, 1)
    equal(retry.after, now + firstRetryMs)
    equal(retry.after <= now + 86400000, true)
  }
}

/** The real bucket, except that the poisoned object keys cannot be deleted. */
function failingBucket(bucket: ObjectBucket, keys: Set<string>): ObjectBucket {
  return {
    delete: async (names: string | string[]) => {
      const requested = Array.isArray(names) ? names : [names]
      if (requested.some(name => keys.has(name))) {
        throw new Error('R2_OBJECT_DELETE_FAILED')
      }
      await bucket.delete(names)
    },
  }
}

async function dueAt(context: Runtime, id: string, gcAfter: number): Promise<void> {
  await context.db.prepare('UPDATE assets SET gc_after=? WHERE id=?').bind(gcAfter, id).run()
}

async function state(context: Runtime, id: string): Promise<string> {
  const row = await context.db
    .prepare('SELECT state FROM assets WHERE id=?')
    .bind(id)
    .first<{ state: string }>()
  return row?.state ?? 'missing'
}

async function retryOf(
  context: Runtime,
  id: string,
): Promise<{ attempts: number, after: number }> {
  const row = await context.db
    .prepare('SELECT gc_attempts,gc_after FROM assets WHERE id=?')
    .bind(id)
    .first<{ gc_attempts: number, gc_after: number }>()
  return { attempts: row?.gc_attempts ?? -1, after: row?.gc_after ?? -1 }
}
