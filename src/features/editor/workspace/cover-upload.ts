import type { MediaAsset, UploadRole } from '@/features/media/media-types'
import type { MediaUploadModel } from '@/features/media/upload-queue'
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { MediaUploadQueue } from '@/features/media/upload-queue'

export type CoverUpload = (file: File, signal: AbortSignal) => Promise<MediaAsset>

export function useCoverUpload(upload: CoverUpload, select: (asset: MediaAsset) => void): MediaUploadModel {
  const [session] = useState(() => new CoverUploadSession(upload, select))
  useLayoutEffect(() => session.update(upload, select), [
    session,
    upload,
    select,
  ])
  const { queue } = session
  const uploads = useSyncExternalStore(queue.subscribe, queue.snapshot, queue.snapshot)
  const [role, setRole] = useState<UploadRole>('image')
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent): void => {
      if (queue.snapshot().running) {
        event.preventDefault()
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      session.dispose()
    }
  }, [session, queue])
  return { role, setRole, queue, uploads, uploading: uploads.running }
}

class CoverUploadSession {
  private readonly lifetime = new AbortController()
  readonly queue = new MediaUploadQueue(
    async file => await this.upload(file, this.lifetime.signal),
    asset => this.select(asset),
  )

  constructor(private upload: CoverUpload, private select: (asset: MediaAsset) => void) {}

  update(upload: CoverUpload, select: (asset: MediaAsset) => void): void {
    this.upload = upload
    this.select = select
  }

  dispose(): void {
    this.lifetime.abort()
    this.queue.dispose()
  }
}
