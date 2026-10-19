import type { MediaAsset, MediaRole, UploadRole } from '@/features/media/media-types'
import { assetListSchema } from '@/contracts/media'
import { sessionSchema } from '@/contracts/session'
import { uploadMedia } from '@/features/editor/media/media-service'
import { hasPendingUploads, MediaUploadQueue } from '@/features/media/upload-queue'
import { APIError, Client, get } from '@/shared/admin/api-client'
import { adminError } from '@/shared/admin/errors'

type GalleryState = {
  items: MediaAsset[]
  cursor: string | null
  loaded: boolean
  loading: boolean
  error: string
  role: UploadRole
  open: boolean
}

export class GallerySession {
  private readonly initial: GalleryState = {
    items: [],
    cursor: null,
    loaded: false,
    loading: true,
    error: '',
    role: 'auto',
    open: false,
  }

  private state = this.initial
  private readonly listeners = new Set<() => void>()
  private readonly lifetime = new AbortController()
  private readonly client: Client
  private listing = false
  private disposed = false
  private completion = 0
  private readonly uploaded = new Map<string, { asset: MediaAsset, completion: number }>()
  readonly queue = new MediaUploadQueue(
    async (file, role) => await this.upload(file, role),
    asset => this.accept(asset),
  )

  constructor(readonly owner: string, csrfToken: string) {
    this.client = new Client(csrfToken, owner)
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.warn)
    }
  }

  snapshot = (): GalleryState => this.state
  serverSnapshot = (): GalleryState => this.initial
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setRole = (role: UploadRole): void => this.update({ role })
  setOpen = (open: boolean): void => this.update({ open })

  load = async (more = false): Promise<void> => {
    if (this.listing || this.disposed || (more && this.state.cursor === null)) {
      return
    }
    this.listing = true
    this.update({ loading: true, error: '' })
    const cursor = this.state.cursor
    const startedAt = this.completion
    try {
      await this.verify()
      const path = `/api/admin/assets${more ? `?cursor=${encodeURIComponent(cursor ?? '')}` : ''}`
      const result = await get(path, assetListSchema, this.lifetime.signal)
      this.lifetime.signal.throwIfAborted()
      const items = this.listed(result.items, startedAt, more)
      this.update({ items, cursor: result.nextCursor, loaded: true })
    }
    catch (error) {
      this.failure(error, 'Unable to load media.')
    }
    finally {
      this.listing = false
      this.update({ loading: false })
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.lifetime.abort()
    this.uploaded.clear()
    this.queue.dispose()
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.warn)
    }
    this.state = { ...this.initial, loading: false, error: adminError(new APIError(401, 'AUTH_INVALID'), '') }
    this.notify()
  }

  isDisposed(): boolean {
    return this.disposed
  }

  private listed(remote: MediaAsset[], startedAt: number, more: boolean): MediaAsset[] {
    // Only protect completions racing this read; later listings remain authoritative.
    const completedDuringRead = Array.from(this.uploaded.values())
      .filter(item => item.completion > startedAt)
      .reverse()
      .map(item => item.asset)
    const items = uniqueAssets([
      ...completedDuringRead,
      ...(more ? this.state.items : []),
      ...remote,
    ])
    for (const [id, item] of this.uploaded) {
      if (item.completion <= startedAt) {
        this.uploaded.delete(id)
      }
    }
    return items
  }

  private async verify(): Promise<void> {
    const session = await get('/api/admin/session', sessionSchema, this.lifetime.signal)
    this.lifetime.signal.throwIfAborted()
    if (session.ownerSub !== this.owner) {
      throw new APIError(401, 'AUTH_INVALID')
    }
    this.client.csrfToken = session.csrfToken
  }

  private async upload(file: File, role: MediaRole): Promise<MediaAsset> {
    try {
      await this.verify()
      return await uploadMedia(this.client, file, role, this.lifetime.signal)
    }
    catch (error) {
      if (error instanceof APIError && (error.status === 401 || error.code === 'AUTH_INVALID')) {
        this.dispose()
      }
      throw error
    }
  }

  private accept(asset: MediaAsset): void {
    if (!this.disposed) {
      this.uploaded.set(asset.assetId, { asset, completion: ++this.completion })
      this.update({ items: uniqueAssets([
        asset,
        ...this.state.items,
      ]), loaded: true })
    }
  }

  private failure(error: unknown, fallback: string): void {
    if (error instanceof APIError && (error.status === 401 || error.code === 'AUTH_INVALID')) {
      this.dispose()
    }
    else {
      this.update({ error: adminError(error, fallback) })
    }
  }

  private readonly warn = (event: BeforeUnloadEvent): void => {
    if (hasPendingUploads(this.queue.snapshot())) {
      event.preventDefault()
    }
  }

  private update(patch: Partial<GalleryState>): void {
    if (!this.disposed) {
      this.state = { ...this.state, ...patch }
      this.notify()
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

function uniqueAssets(items: MediaAsset[]): MediaAsset[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.assetId)) {
      return false
    }
    seen.add(item.assetId)
    return true
  })
}

let retained: GallerySession | null = null

export function gallerySession(owner: string, csrfToken: string): GallerySession {
  if (typeof window === 'undefined') {
    return new GallerySession(owner, csrfToken)
  }
  if (retained?.owner !== owner || retained.isDisposed()) {
    retained?.dispose()
    retained = new GallerySession(owner, csrfToken)
  }
  return retained
}

export async function openGallery(owner: string, signal: AbortSignal): Promise<GallerySession> {
  const session = await get('/api/admin/session', sessionSchema, signal)
  signal.throwIfAborted()
  if (session.ownerSub !== owner) {
    if (retained !== null && retained.owner !== session.ownerSub) {
      retained.dispose()
      retained = null
    }
    throw new APIError(401, 'AUTH_INVALID')
  }
  return gallerySession(owner, session.csrfToken)
}
