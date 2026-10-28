import type { DeparturePermit } from '@/features/editor/workspace/editor-departure'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import type { MediaAsset, MediaRole, UploadRole } from '@/features/media/media-types'
import type { MediaUploadModel } from '@/features/media/upload-queue'
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { MediaDestinations } from '@/features/editor/media/media-destinations'
import { attachMedia } from '@/features/editor/media/media-placement'
import { approvedUnload } from '@/features/editor/workspace/editor-departure'
import { hasPendingUploads, MediaUploadQueue } from '@/features/media/upload-queue'

export type EditorUploadModel = MediaUploadModel & {
  open: boolean
  setOpen: (open: boolean) => void
  loading: boolean
  target: string | undefined
  editing: boolean
  sourceRole: UploadRole
  request: (target?: string) => void
  select: (asset: MediaAsset) => void
  isOpen: () => boolean
}

/**
 * Owns the editor's upload queue and, with draft persistence, the browser's
 * unsaved-work warning for pending uploads. The one departure the editor
 * boundary already approved skips that warning.
 */
export function useEditorMediaUpload(workspace: Workspace, permit: DeparturePermit | null): EditorUploadModel {
  const [target, setTarget] = useState<string>()
  const [session] = useState(() => new EditorUploadSession(workspace, setTarget))
  useLayoutEffect(() => {
    session.update(workspace)
  }, [session, workspace])
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState<UploadRole>('auto')
  const { queue } = session
  const uploads = useSyncExternalStore(queue.subscribe, queue.snapshot, queue.snapshot)
  useLayoutEffect(() => {
    const unload = (event: BeforeUnloadEvent): void => {
      const approved = approvedUnload(permit, event)
      if (session.pending() && !approved) {
        event.preventDefault()
      }
    }
    window.addEventListener('beforeunload', unload)
    return () => window.removeEventListener('beforeunload', unload)
  }, [session, permit])
  return {
    role,
    setRole,
    queue,
    uploads,
    uploading: uploads.running,
    loading: workspace.busy || workspace.model.uploading,
    open,
    target,
    editing,
    sourceRole: session.sourceRole,
    isOpen: () => openRef.current,
    request: (id) => {
      if (!session.canRequest()) {
        return
      }
      const settings = session.prepare(id, id !== target)
      setTarget(id)
      setEditing(settings.editing)
      setRole(settings.role)
      openRef.current = true
      setOpen(true)
    },
    select: asset => session.select(asset),
    setOpen: (value) => {
      if (!queue.snapshot().running) {
        openRef.current = value
        setOpen(value)
      }
    },
  }
}

class EditorUploadSession {
  sourceRole: UploadRole = 'auto'
  private readonly destinations = new MediaDestinations()
  readonly queue = new MediaUploadQueue<string>(
    async (file, role) => await this.upload(file, role),
    (id, _file, role) => {
      if (role !== 'caption' && role !== 'poster') {
        this.ready(id)
      }
    },
    this.destinations.beginBatch,
  )

  constructor(private workspace: Workspace, private readonly ready: (id: string) => void) {}
  update(workspace: Workspace): void {
    this.workspace = workspace
  }

  pending(): boolean {
    return hasPendingUploads(this.queue.snapshot()) || this.workspace.model.hasUploads()
  }

  canRequest(): boolean {
    const { busy, model } = this.workspace
    return !this.queue.snapshot().running && !busy && !model.uploading && !model.composingRef.current
  }

  prepare(target: string | undefined, reset: boolean): Pick<EditorUploadModel, 'role' | 'editing'> {
    if (reset) {
      this.queue.clearCompleted()
      for (const item of this.queue.snapshot().items) {
        this.queue.remove(item.id)
      }
    }
    this.destinations.prepare(target ?? this.workspace.model.editor.getTextCursorPosition().block.id, target, reset)
    const block = target === undefined ? undefined : this.workspace.model.editor.getBlock(target)
    this.sourceRole = blockRole(block?.type)
    return {
      editing: block !== undefined && 'url' in block.props && block.props.url !== '',
      role: this.sourceRole,
    }
  }

  select(asset: MediaAsset): void {
    const destination = this.destinations.selected()
    if (destination !== undefined) {
      attachMedia(this.workspace, asset, destination)
    }
  }

  private async upload(file: File, role: MediaRole): Promise<string> {
    const destination = this.destinations.destination(file, role)
    const { busy, model } = this.workspace
    if (busy || model.composingRef.current) {
      throw new Error('Wait for the draft to finish saving, then retry.')
    }
    const id = await model.uploadFiles([file], role, destination?.anchor, destination?.replace)
    this.destinations.accepted(file, role, id)
    return id
  }
}

function blockRole(type?: string): UploadRole {
  const role = type ?? ''
  switch (role) {
    case 'image':
    case 'audio':
    case 'video':
    case 'file': return role
    default: return 'auto'
  }
}
