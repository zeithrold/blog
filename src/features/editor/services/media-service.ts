import type { z } from 'zod'
import type {
  assetRoleSchema,
} from '@/content/service-contracts'
import type { Client } from '@/features/editor/services/api-client'
import type { MediaTransferSession } from '@/features/editor/services/media-transfer-session'
import {
  assetAllocationSchema,
  assetDescriptorSchema,
} from '@/content/service-contracts'
import { APIError, get, read } from '@/features/editor/services/api-client'
import { mediaTransferSession } from '@/features/editor/services/media-transfer-session'

type Role = z.infer<typeof assetRoleSchema>
type Asset = z.infer<typeof assetDescriptorSchema>

export async function uploadMedia(
  client: Client,
  file: File,
  role: Role,
  signal?: AbortSignal,
): Promise<Asset> {
  signal?.throwIfAborted()
  const session = mediaTransferSession(client, file, role)
  if (session.allocation !== null) {
    await client.verifyOwner(signal)
    const recovered = await recoverReady(session, signal)
    if (recovered !== null) {
      return recovered
    }
  }
  const type = file.type === 'audio/x-wav' ? 'audio/wav' : file.type
  session.allocation ??= await allocate(client, file, role, { type, signal })
  signal?.throwIfAborted()
  try {
    const response = await client.putBlob(session.allocation.uploadPath, file, type, signal)
    const result = await read(response, assetDescriptorSchema)
    signal?.throwIfAborted()
    session.allocation = null
    return result
  }
  catch (error) {
    signal?.throwIfAborted()
    return await reconcile(session, error, { client, signal })
  }
}

async function allocate(client: Client, file: File, role: Role, {
  type,
  signal,
}: { type: string, signal?: AbortSignal }): Promise<
  z.infer<typeof assetAllocationSchema>
> {
  if (file.size > 67108864) {
    throw new APIError(413, 'ASSET_TOO_LARGE')
  }
  const bytes = await file.arrayBuffer()
  signal?.throwIfAborted()
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  signal?.throwIfAborted()
  const sha256 = Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, '0')).join('')
  return await client.mutate({
    path: '/api/admin/assets',
    method: 'POST',
    body: {
      filename: file.name,
      type,
      bytes: file.size,
      sha256,
      role,
    },
    schema: assetAllocationSchema,
    signal,
  })
}

async function recoverReady(session: MediaTransferSession, signal?: AbortSignal): Promise<Asset | null> {
  signal?.throwIfAborted()
  const allocation = session.allocation
  if (allocation === null) {
    return null
  }
  let state: Asset
  try {
    state = await get(`/api/admin/assets/${allocation.assetId}`, assetDescriptorSchema, signal)
    signal?.throwIfAborted()
  }
  catch (error) {
    signal?.throwIfAborted()
    return stateFailure(session, error)
  }
  if (state.state !== 'uploading') {
    session.allocation = null
  }
  return state.state === 'ready' ? state : null
}

function stateFailure(session: MediaTransferSession, error: unknown): null {
  if (error instanceof APIError) {
    if (error.code === 'ASSET_NOT_FOUND') {
      session.allocation = null
      return null
    }
    if (error.status === 401 || error.status === 403) {
      throw error
    }
  }
  throw new APIError(503, 'UPLOAD_OUTCOME_UNKNOWN')
}

async function reconcile(session: MediaTransferSession, error: unknown, {
  client,
  signal,
}: { client: Client, signal?: AbortSignal }): Promise<Asset> {
  if (error instanceof APIError && ((error.status >= 400 && error.status < 500) || error.code === 'MAINTENANCE')) {
    if (error.code === 'UPLOAD_SESSION_EXPIRED') {
      session.allocation = null
    }
    throw error
  }
  await client.verifyOwner(signal)
  const recovered = await recoverReady(session, signal)
  if (recovered !== null) {
    return recovered
  }
  throw error instanceof APIError ? error : new APIError(0, 'CONNECTION_FAILED')
}
