import type { MouseEvent, RefObject } from 'react'
import type { editorSchema } from '@/features/editor/core/schema'
import { ShowSelectionExtension } from '@blocknote/core/extensions'
import { useBlockNoteEditor, useExtension } from '@blocknote/react'
import { createContext, use, useEffect, useRef, useState } from 'react'

type Editor = typeof editorSchema.BlockNoteEditor
export type FormattingOptions = {
  editor: Editor
  open: boolean
  page: 'actions' | 'colors'
  setPage: (page: 'actions' | 'colors') => void
  setOpen: (open: boolean) => void
  show: () => void
  afterClose: () => void
  runAfterClose: (action: (event: MouseEvent) => void, event: MouseEvent) => void
}
export const FormattingOptionsContext = createContext<FormattingOptions | null>(null)
export const ImmediateFormattingActionContext = createContext(false)

export function useFormattingOptions(): FormattingOptions {
  const value = use(FormattingOptionsContext)
  if (value === null) {
    throw new Error('Formatting options require their editor context')
  }
  return value
}

export function useFormattingOptionsModel(
  compact: boolean,
  disabled: boolean,
  composingRef: RefObject<boolean>,
): FormattingOptions {
  const editor = useBlockNoteEditor<
    typeof editorSchema.blockSchema,
    typeof editorSchema.inlineContentSchema,
    typeof editorSchema.styleSchema
  >()
  const selection = useExtension(ShowSelectionExtension)
  const [state, setState] = useState({ compact, disabled, open: false, generation: 0 })
  const [page, setPage] = useState<'actions' | 'colors'>('actions')
  const pendingRef = useRef<{ run: () => void, generation: number } | null>(null)
  if (state.compact !== compact || state.disabled !== disabled) {
    setState({ compact, disabled, open: false, generation: state.generation + 1 })
  }
  const { open } = state
  useEffect(() => {
    selection.showSelection(open, 'formattingOptions')
    return () => selection.showSelection(false, 'formattingOptions')
  }, [selection, open])
  const setOpen = (value: boolean): void => setState(current => ({ ...current, open: value }))
  return {
    editor,
    open,
    page,
    setPage,
    setOpen,
    show: () => {
      if (!disabled && editor.isEditable && !composingRef.current) {
        pendingRef.current = null
        setPage('actions')
        setOpen(true)
      }
    },
    runAfterClose: (action, event) => {
      pendingRef.current = { run: () => action(event), generation: state.generation }
      setOpen(false)
    },
    afterClose: () => {
      const action = pendingRef.current
      pendingRef.current = null
      editor.focus()
      if (!disabled && editor.isEditable && !composingRef.current && action?.generation === state.generation) {
        action.run()
      }
    },
  }
}
