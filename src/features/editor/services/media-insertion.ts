import type { Envelope } from '@/features/editor/core/model'
import type { editorSchema } from '@/features/editor/core/schema'
import type { MediaAsset } from '@/features/media/media-types'

export type MediaDestination = { anchor: string, replace?: string }
type Input = {
  editor: typeof editorSchema.BlockNoteEditor
  fields: Envelope
  update: (patch: Partial<Envelope>) => void
}

export function insertReadyMedia(input: Input, asset: MediaAsset, destination: MediaDestination): string {
  const { editor, fields, update } = input
  if (asset.role === 'caption' || asset.role === 'poster') {
    return destination.anchor
  }
  const target = destination.replace ?? destination.anchor
  if (editor.getBlock(target) === undefined) {
    throw new Error('The media block was removed. Find the uploaded file in Media library.')
  }
  const id = destination.replace ?? crypto.randomUUID()
  update({
    mediaAccessibility: {
      ...fields.mediaAccessibility,
      [id]: fields.mediaAccessibility[id] ?? {
        alt: '',
        decorative: false,
        transcript: '',
        captionAssetId: null,
        posterAssetId: null,
      },
    },
  })
  const block = { type: asset.role, props: { url: asset.url, name: asset.filename } }
  if (destination.replace !== undefined) {
    editor.updateBlock(id, block)
  }
  else {
    editor.insertBlocks([
      { id, ...block },
    ], destination.anchor, 'after')
  }
  return id
}
