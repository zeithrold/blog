import type { z } from 'zod'
import type { assetRoleSchema } from '@/content/service-contracts'
import type { Envelope } from '@/features/editor/core/model'
import type { editorSchema } from '@/features/editor/core/schema'
import type { Client } from '@/features/editor/services/api-client'
import { useEffect, useRef, useState } from 'react'
import { insertReadyMedia } from '@/features/editor/services/media-insertion'
import { uploadMedia } from '@/features/editor/services/media-service'

type Editor = typeof editorSchema.BlockNoteEditor
type Role = z.infer<typeof assetRoleSchema>
type Inputs = {
  editor: Editor
  client: Client
  composingRef: React.RefObject<boolean>
  fields: React.RefObject<Envelope>
  update: (patch: Partial<Envelope>) => void
}

export type MediaInputs = {
  uploading: boolean
  hasUploads: () => boolean
  uploadFiles: (files: File[], override?: Role, anchor?: string, replace?: string) => Promise<string>
  waitUploads: () => Promise<void>
}

function role(file: File): Role {
  if (file.type.startsWith('image/')) {
    return 'image'
  }
  if (file.type.startsWith('audio/')) {
    return 'audio'
  }
  if (file.type.startsWith('video/')) {
    return 'video'
  }
  return file.type === 'text/vtt' ? 'caption' : 'file'
}
export async function nativeUpload(
  client: Client,
  editor: Editor,
  file: File,
  id?: string,
): Promise<string> {
  if (role(file) === 'caption') {
    throw new Error('Upload captions when editing a video, then assign them to that video.')
  }
  const asset = await uploadMedia(client, file, role(file))
  if (
    editor.domElement?.isConnected !== true
    || (id !== undefined && editor.getBlock(id) === undefined)
  ) {
    throw new Error(
      'The upload completed after its block was removed. Find the file in Media library.',
    )
  }
  return asset.url
}
export function useMediaInputs(input: Inputs): MediaInputs {
  const activeRef = useRef(true)
  const pendingRef = useRef<Promise<string> | null>(null)
  const [uploading, setUploading] = useState(false)
  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])
  const uploadFiles: MediaInputs['uploadFiles'] = async (
    files,
    override,
    anchor = input.editor.getTextCursorPosition().block.id,
    replace,
  ) => {
    if (pendingRef.current !== null || files.length > 5) {
      throw new Error('Upload at most five files at a time; wait for the current upload.')
    }
    setUploading(true)
    const pending = attachFiles({ ...input, files, override, anchor, replace, activeRef })
    pendingRef.current = pending
    try {
      return await pending
    }
    finally {
      pendingRef.current = null
      if (activeRef.current) {
        setUploading(false)
      }
    }
  }
  const waitUploads = async (): Promise<void> => {
    if (pendingRef.current !== null) {
      await pendingRef.current
    }
  }
  return { uploading, hasUploads: () => pendingRef.current !== null, uploadFiles, waitUploads }
}
async function attachFiles(
  input: Inputs & {
    files: File[]
    override?: Role
    anchor: string
    replace?: string
    activeRef: React.RefObject<boolean>
  },
): Promise<string> {
  let anchor = input.anchor
  let replace = input.replace
  for (const file of input.files) {
    const asset = await uploadMedia(input.client, file, input.override ?? role(file))
    await deferInsertion(input.activeRef, input.composingRef)
    if (input.activeRef.current) {
      anchor = insertReadyMedia({
        editor: input.editor,
        fields: input.fields.current,
        update: input.update,
      }, asset, { anchor, replace })
      if (asset.role !== 'caption' && asset.role !== 'poster') {
        replace = undefined
      }
    }
  }
  return anchor
}
async function deferInsertion(
  activeRef: React.RefObject<boolean>,
  composingRef: React.RefObject<boolean>,
): Promise<void> {
  while (activeRef.current && composingRef.current) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50)
    })
  }
}
