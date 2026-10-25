import type { ApiCall } from '~/tests/components/support/http-fixtures'
import { Buffer } from 'node:buffer'
import { allocateAssetSchema, assetAllocationSchema, assetDescriptorSchema, assetListSchema } from '@/contracts/media'
import { sessionSchema } from '@/contracts/session'
import { COMPONENT_TEST_FIXTURES } from '~/tests/components/src/fixtures'

/**
 * Media data for the component browser specs.
 *
 * Every body is built through the application's own schemas, so a fixture cannot
 * describe a session, allocation or asset the gallery would reject, and a spec
 * that changes a contract field fails here instead of rendering an untested shape.
 */
export type MediaAsset = ReturnType<typeof assetDescriptorSchema.parse>
export type MediaPage = ReturnType<typeof assetListSchema.parse>
export type MediaAllocation = ReturnType<typeof assetAllocationSchema.parse>
export type AllocationRequest = ReturnType<typeof allocateAssetSchema.parse>

/** A 1x1 PNG: the private bytes a ready image advertises. */
export const previewBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ'
  + 'AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

export function mediaSession(): ReturnType<typeof sessionSchema.parse> {
  return sessionSchema.parse({
    ownerSub: COMPONENT_TEST_FIXTURES.owner,
    csrfToken: COMPONENT_TEST_FIXTURES.csrfToken,
  })
}

export function mediaPage(items: readonly MediaAsset[], nextCursor: string | null = null): MediaPage {
  return assetListSchema.parse({ items, nextCursor })
}

/** What the fixture's server answers when it accepted an allocation. */
export function allocation(assetId: string): MediaAllocation {
  return assetAllocationSchema.parse({
    assetId,
    state: 'uploading',
    uploadPath: `/api/admin/assets/${assetId}/content`,
  })
}

/** The allocation the client asked for, parsed by the product's own request contract. */
export function allocationRequest(call: ApiCall): AllocationRequest {
  return allocateAssetSchema.parse(call.json)
}

/** The asset an allocation refers to, in the state the fixture's server reports. */
export function assetFor(
  assetId: string,
  request: AllocationRequest,
  state: MediaAsset['state'] = 'ready',
): MediaAsset {
  return assetDescriptorSchema.parse({
    assetId,
    state,
    // The server stores a public path on the descriptor; a ready image previews
    // from its private content path instead, exactly as the manager renders it.
    url: `/assets/${assetId}`,
    filename: request.filename,
    type: request.type,
    bytes: request.bytes,
    sha256: request.sha256,
    role: request.role,
  })
}
