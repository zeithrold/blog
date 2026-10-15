'use client'
import type { GallerySession } from '@/features/media/gallery-session'
import type { MediaUploadModel } from '@/features/media/upload-queue'
import { useEffect, useSyncExternalStore } from 'react'

export type { MediaAsset, MediaRole } from '@/features/media/media-types'

type Model = ReturnType<GallerySession['snapshot']> & MediaUploadModel & {
  load: GallerySession['load']
  setOpen: GallerySession['setOpen']
  unavailable: boolean
}

export function useMediaManager(session: GallerySession): Model {
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.serverSnapshot)
  const { queue } = session
  const uploads = useSyncExternalStore(queue.subscribe, queue.snapshot, queue.snapshot)
  useEffect(() => {
    session.load().catch(() => {})
  }, [session])
  return {
    ...state,
    queue,
    uploads,
    uploading: uploads.running,
    unavailable: session.isDisposed(),
    load: session.load,
    setRole: session.setRole,
    setOpen: session.setOpen,
  }
}
