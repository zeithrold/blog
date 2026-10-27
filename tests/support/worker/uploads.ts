import type { Buffer } from 'node:buffer'
import type { Runtime } from '~/tests/support/worker/runtime'
import { createHash } from 'node:crypto'
import { assetAllocationSchema, assetDescriptorSchema } from '@/contracts/media'
import { json } from '~/tests/support/worker/responses'

export type StoredMedia = {
  assetId: string
  objectKey: string
  bytes: Buffer
}

/** Allocate, transfer and confirm one ready asset through the admin API. */
export async function uploadFile(
  context: Runtime,
  filename: string,
  bytes: Buffer,
): Promise<StoredMedia> {
  const input = {
    filename,
    role: 'file' as const,
    type: 'text/plain',
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
  const allocation = await json(
    await context.write('/api/admin/assets', input),
    201,
    assetAllocationSchema,
  )
  await json(
    await context.fetch(allocation.uploadPath, {
      method: 'PUT',
      headers: {
        'origin': context.origin,
        'x-csrf-token': context.csrfToken,
        'content-type': input.type,
        'content-length': String(bytes.length),
      },
      body: bytes,
    }),
    200,
    assetDescriptorSchema,
  )
  const row = await context.db
    .prepare('SELECT object_key FROM assets WHERE id=?')
    .bind(allocation.assetId)
    .first<{ object_key: string }>()
  if (row === null) {
    throw new Error(`missing asset ${allocation.assetId}`)
  }
  return { assetId: allocation.assetId, objectKey: row.object_key, bytes }
}
