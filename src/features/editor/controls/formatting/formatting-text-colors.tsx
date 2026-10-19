import type { ReactNode } from 'react'
import type { editorSchema } from '@/features/editor/engine/schema'
import { useDictionary, useEditorState } from '@blocknote/react'
import { ColorGrid } from '@/components/ui/ztd-me/ui/color-grid'
import { colorOptions } from '@/features/editor/controls/color-palette'
import { useFormattingOptions } from '@/features/editor/controls/formatting/formatting-options-model'

type Editor = typeof editorSchema.BlockNoteEditor
export function FormattingTextColors(): ReactNode {
  return <EditorTextColors editor={useFormattingOptions().editor} />
}
export function EditorTextColors({ editor }: { editor: Editor }): ReactNode {
  return (
    <div className="grid gap-5">
      <TextColorGroup editor={editor} kind="text" />
      <TextColorGroup editor={editor} kind="background" />
    </div>
  )
}
function TextColorGroup({ kind, editor }: { kind: 'text' | 'background', editor: Editor }): ReactNode {
  const { color_picker: text } = useDictionary()
  const property = kind === 'text' ? 'textColor' : 'backgroundColor'
  const current = useEditorState({ editor, selector: () => editor.getActiveStyles()[property] ?? 'default' })
  return (
    <div data-color-kind={kind}>
      <ColorGrid
        label={kind === 'text' ? text.text_title : text.background_title}
        options={colorOptions(text.colors, kind)}
        value={current}
        disabled={!editor.isEditable}
        onValueChange={(color: string) => {
          if (editor.isEditable) {
            const styles = { [property]: color }
            if (color === 'default') {
              editor.removeStyles(styles)
            }
            else {
              editor.addStyles(styles)
            }
          }
        }}
      />
    </div>
  )
}
