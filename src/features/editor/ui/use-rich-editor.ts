import type { editorSchema } from '@/features/editor/core/schema'
import { useBlockNoteEditor } from '@blocknote/react'

export function useRichEditor(): typeof editorSchema.BlockNoteEditor {
  return useBlockNoteEditor<
    typeof editorSchema.blockSchema,
    typeof editorSchema.inlineContentSchema,
    typeof editorSchema.styleSchema
  >()
}
