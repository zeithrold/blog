import type { editorSchema } from '@/features/editor/engine/schema'
import { useBlockNoteEditor } from '@blocknote/react'

export function useRichEditor(): typeof editorSchema.BlockNoteEditor {
  return useBlockNoteEditor<
    typeof editorSchema.blockSchema,
    typeof editorSchema.inlineContentSchema,
    typeof editorSchema.styleSchema
  >()
}
