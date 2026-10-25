import type { Runtime } from '~/tests/support/worker/runtime'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { assetAllocationSchema } from '@/contracts/media'
import { deepEqual, equal } from '~/tests/support/unit/assertions'
import { json, refusal } from '~/tests/support/worker/responses'
import { runtime } from '~/tests/support/worker/runtime'

/**
 * One allocation is one stored asset row, and the same idempotency key replays
 * that row instead of allocating a second one.
 *
 * The browser component cases prove the client sends one allocation for an
 * attempt and its retry; only the real Worker and D1 can prove the row count and
 * the replay, so this case owns that half of the contract.
 */
const bytes = Buffer.from('Allocated once')
const input = {
  filename: 'allocation.txt',
  role: 'file' as const,
  type: 'text/plain',
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
}

/** Every stored asset row this filename has, by id, oldest first. */
async function stored(context: Runtime, filename: string): Promise<string[]> {
  const rows = await context.db.prepare(
    'SELECT id FROM assets WHERE filename=? ORDER BY created_at,id',
  ).bind(filename).all<{ id: string }>()
  return rows.results.map(row => row.id)
}

test('asset allocation stores one row and replays it for the same idempotency key', async () => {
  const context = await runtime()
  try {
    const key = crypto.randomUUID()
    const allocation = await json(
      await context.write('/api/admin/assets', input, 'POST', key),
      201,
      assetAllocationSchema,
    )
    // The allocation is committed before any transfer, so the row already exists.
    deepEqual(await stored(context, input.filename), [allocation.assetId])

    const replay = await json(
      await context.write('/api/admin/assets', input, 'POST', key),
      201,
      assetAllocationSchema,
    )
    equal(replay.assetId, allocation.assetId)
    equal(replay.uploadPath, allocation.uploadPath)
    deepEqual(await stored(context, input.filename), [allocation.assetId])

    // Reusing the key for a different request is refused, not silently replayed
    // and not stored as a second asset.
    equal(
      await refusal(
        await context.write('/api/admin/assets', { ...input, filename: 'reused.txt' }, 'POST', key),
        409,
      ),
      'IDEMPOTENCY_KEY_REUSED',
    )
    deepEqual(await stored(context, input.filename), [allocation.assetId])
    deepEqual(await stored(context, 'reused.txt'), [])
  }
  finally {
    await context.dispose()
  }
}).catch((error: unknown) => { throw error })
