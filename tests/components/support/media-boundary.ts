import type { Page } from '@playwright/test'
import type { Buffer } from 'node:buffer'
import type { ApiCall, ApiHandler, ApiReply, defer } from './http-fixtures'
import type { AllocationRequest, MediaAsset } from './media-fixtures'
import { serveApi } from './http-fixtures'
import { allocation, allocationRequest, assetFor, mediaPage, mediaSession, previewBytes } from './media-fixtures'

export type Held = ReturnType<typeof defer>

/** One allocation the client asked for, with the request that asked for it. */
export type GalleryAllocation = {
  readonly assetId: string
  readonly request: AllocationRequest
}

/** Everything a media surface asked for, in request order. */
export type MediaLedger = {
  /** Every allocation the client asked for. */
  readonly allocations: GalleryAllocation[]
  /** Every transfer path that arrived. */
  readonly transfers: string[]
  /**
   * Every asset this case's server described, by id: the allocations the client
   * asked for and the assets a listing served. It is what the private-bytes
   * route knows an asset by, so a listed image previews from the bytes its
   * descriptor names.
   */
  readonly assets: Map<string, MediaAsset>
}

/** A case's record of what its own media server holds and was asked for. */
export function mediaLedger(): MediaLedger {
  return { allocations: [], transfers: [], assets: new Map() }
}

export type GalleryBoundary = MediaLedger & {
  readonly api: Awaited<ReturnType<typeof serveApi>>
}

/**
 * The media wire every surface shares: one allocation plus transfer per queued
 * file, the listing reads a manager makes, and the descriptor reads a retry makes
 * before it decides to resume or replace an upload.
 *
 * The case owns what the server holds and when it answers, so a read can be held
 * open, made authoritative, or reported in any transfer state without a second
 * fake layer. `read` and `attempt` are 1-based, the order the client asks in.
 */
export function mediaHandlers(ledger: MediaLedger, options: {
  listing?: (read: number) => readonly MediaAsset[] | Promise<readonly MediaAsset[]>
  /** The descriptor the server reports for an allocated asset, for the nth read. */
  descriptor?: (read: number, allocation: GalleryAllocation) => ApiReply | Promise<ApiReply>
  /** What the nth transfer attempt does; the default stores the file. */
  transfer?: (
    attempt: number,
    allocation: GalleryAllocation,
  ) => ApiReply | Promise<ApiReply>
  /** Keeps the first transfer unanswered until the case opens it. */
  hold?: Held
} = {}): Record<string, ApiHandler> {
  let reads = 0
  let descriptors = 0
  return {
    'GET /api/admin/session': () => ({ body: mediaSession() }),
    'GET /api/admin/assets': async () => {
      reads += 1
      const items = await (options.listing?.(reads) ?? [])
      for (const item of items) {
        ledger.assets.set(item.assetId, item)
      }
      return { body: mediaPage(items) }
    },
    'POST /api/admin/assets': (call) => {
      const request = allocationRequest(call)
      const assetId = crypto.randomUUID()
      ledger.allocations.push({ assetId, request })
      ledger.assets.set(assetId, assetFor(assetId, request))
      return { body: allocation(assetId) }
    },
    'GET /api/admin/assets/:id': async (call: ApiCall) => {
      const known = allocated(call, ledger.allocations)
      descriptors += 1
      return await (options.descriptor?.(descriptors, known)
        ?? { body: assetFor(known.assetId, known.request) })
    },
    'PUT /api/admin/assets/:id/content': async (call) => {
      const known = allocated(call, ledger.allocations)
      ledger.transfers.push(call.path)
      if (options.hold !== undefined && ledger.transfers.length === 1) {
        await options.hold.promise
      }
      return await (options.transfer?.(ledger.transfers.length, known)
        ?? { body: assetFor(known.assetId, known.request) })
    },
  }
}

/** What a case serves for one asset's private bytes. */
export type PreviewReply = { contentType: string, body: Buffer | string }

export async function serveGallery(
  page: Page,
  options: Parameters<typeof mediaHandlers>[1] = {},
): Promise<GalleryBoundary> {
  const ledger = mediaLedger()
  const api = await serveApi(page, mediaHandlers(ledger, options))
  await serveMediaPreviews(page, { ledger })
  return { api, ...ledger }
}

/** The allocation a descriptor read or transfer names, so a case can echo it back. */
function allocated(call: ApiCall, allocations: readonly GalleryAllocation[]): GalleryAllocation {
  const assetId = call.path.split('/').at(-1) === 'content'
    ? call.path.split('/').at(-2) ?? ''
    : call.path.split('/').at(-1) ?? ''
  const known = allocations.find(entry => entry.assetId === assetId)
  if (known === undefined) {
    throw new Error(`A request named an asset no allocation described: ${call.path}`)
  }
  return known
}

/**
 * The private bytes a ready asset serves from its content path.
 *
 * An image or poster previews as the fixture's 1x1 PNG, which is what the gallery
 * card and the picker render. Anything else - a video, an audio file, a caption
 * track - must be described by the case through `content`, using the bytes it
 * actually uploaded: a read nothing described falls through to the API boundary,
 * which reports it as unhandled and fails the case instead of silently answering
 * an image for a video.
 *
 * Register it after the case's API route so it answers first, as Playwright matches
 * the last registered route. Returns the asset ids it actually served, so a case can
 * prove the read it depends on hit this route.
 */
export async function serveMediaPreviews(page: Page, options: {
  ledger: MediaLedger
  content?: (allocation: GalleryAllocation) => PreviewReply | undefined
}): Promise<{ served: readonly string[] }> {
  const served: string[] = []
  await page.route('**/api/admin/assets/*/content', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    const assetId = new URL(route.request().url()).pathname.split('/').at(-2) ?? ''
    const known = options.ledger.allocations.find(entry => entry.assetId === assetId)
    const described = known === undefined ? undefined : options.content?.(known)
    const reply = described ?? defaultPreview(known, options.ledger.assets.get(assetId))
    if (reply === undefined) {
      await route.fallback()
      return
    }
    served.push(assetId)
    await route.fulfill({ status: 200, contentType: reply.contentType, body: reply.body })
  })
  return { served }
}

function defaultPreview(
  known: GalleryAllocation | undefined,
  listed: MediaAsset | undefined,
): PreviewReply | undefined {
  const role = known?.request.role ?? listed?.role
  return role === 'image' || role === 'poster'
    ? { contentType: 'image/png', body: previewBytes }
    : undefined
}
