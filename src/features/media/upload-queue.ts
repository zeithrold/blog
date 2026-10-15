import type { MediaAsset, MediaRole, UploadRole } from '@/features/media/media-types'
import { inferMediaRole } from '@/features/media/media-types'
import { adminError } from '@/shared/admin/errors'

export type UploadItem = {
  id: string
  file: File
  role: MediaRole
  state: 'queued' | 'uploading' | 'complete' | 'failed'
  error: string
}
export type UploadState = { items: UploadItem[], running: boolean }
export function hasPendingUploads(state: UploadState): boolean {
  return state.running || state.items.some(item => item.state === 'queued' || item.state === 'failed')
}
export type MediaUploadModel = {
  role: UploadRole
  setRole: (role: UploadRole) => void
  queue: Pick<MediaUploadQueue<unknown>, 'snapshot' | 'subscribe' | 'enqueue' | 'start' | 'remove' | 'clearCompleted'>
  uploads: UploadState
  uploading: boolean
}
type Upload<Result> = (file: File, role: MediaRole) => Promise<Result>

export class MediaUploadQueue<Result = MediaAsset> {
  private state: UploadState = { items: [], running: false }
  private readonly listeners = new Set<() => void>()
  private disposed = false

  constructor(
    private readonly upload: Upload<Result>,
    private readonly ready: (asset: Result, file: File, role: MediaRole) => void,
    private readonly beginBatch: () => void = () => {},
  ) {}

  snapshot = (): UploadState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  enqueue(files: readonly File[], role: UploadRole): void {
    if (this.state.running || this.disposed) {
      return
    }
    const items = [
      ...this.state.items,
    ]
    for (const file of files) {
      const assigned = role === 'auto' ? inferMediaRole(file) : role
      const same = items.find(item => fileIdentity(item.file, item.role) === fileIdentity(file, assigned))
      if (same !== undefined) {
        if (same.state === 'failed') {
          items[items.indexOf(same)] = { ...same, state: 'queued', error: '' }
        }
        continue
      }
      items.push({ id: crypto.randomUUID(), file, role: assigned, state: 'queued', error: '' })
    }
    this.update({ items })
  }

  remove(id: string): void {
    if (!this.state.running && !this.disposed) {
      this.update({ items: this.state.items.filter(item => item.id !== id) })
    }
  }

  clearCompleted(): void {
    if (!this.state.running && !this.disposed) {
      this.update({ items: this.state.items.filter(item => item.state !== 'complete') })
    }
  }

  async start(onlyId?: string): Promise<void> {
    if (this.state.running || this.disposed) {
      return
    }
    const candidates = this.state.items.filter(item => onlyId === undefined
      ? item.state === 'queued'
      : item.id === onlyId && item.state === 'failed')
    if (candidates.length === 0) {
      return
    }
    this.update({ running: true })
    try {
      if (onlyId === undefined) {
        this.beginBatch()
      }
      for (const item of candidates) {
        if (!this.active()) {
          break
        }
        await this.attempt(item)
      }
    }
    finally {
      this.update({ running: false })
    }
  }

  private async attempt(item: UploadItem): Promise<void> {
    this.patch(item.id, { state: 'uploading', error: '' })
    try {
      const asset = await this.upload(item.file, item.role)
      if (this.disposed) {
        return
      }
      this.ready(asset, item.file, item.role)
      this.patch(item.id, { state: 'complete' })
    }
    catch (failure) {
      this.patch(item.id, {
        state: 'failed',
        error: adminError(failure, 'Unable to upload this file. Retry or choose another file.'),
      })
    }
  }

  private active(): boolean {
    return !this.disposed
  }

  private patch(id: string, patch: Partial<UploadItem>): void {
    this.update({ items: this.state.items.map(item => item.id === id ? { ...item, ...patch } : item) })
  }

  private update(patch: Partial<UploadState>): void {
    if (this.disposed) {
      return
    }
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) {
      listener()
    }
  }

  dispose(): void {
    this.disposed = true
    this.state = { items: [], running: false }
    for (const listener of this.listeners) {
      listener()
    }
    this.listeners.clear()
  }
}

function fileIdentity(file: File, role: MediaRole): string {
  return JSON.stringify([
    file.name,
    file.size,
    file.lastModified,
    file.type,
    role,
  ])
}
