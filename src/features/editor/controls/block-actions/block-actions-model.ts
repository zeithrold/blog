import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { editorSchema } from '@/features/editor/engine/schema'
import { SideMenuExtension } from '@blocknote/core/extensions'
import { useBlockNoteEditor, useEditorState, useExtension } from '@blocknote/react'
import { createContext, use, useEffect, useMemo, useRef, useState } from 'react'
import { EditorMediaContext } from '@/features/editor/media/media-context'

export const BlockActionsContext = createContext<{
  open: boolean
  show: (id: string) => void
} | null>(null)

export type BlockActionsModel = {
  editor: typeof editorSchema.BlockNoteEditor
  block: typeof editorSchema.Block | undefined
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  page: 'actions' | 'colors'
  setPage: Dispatch<SetStateAction<'actions' | 'colors'>>
  context: { open: boolean, show: (id: string) => void }
  finishClose: (restoreFocus?: boolean) => void
}
export type BlockActionsProps = { compact: boolean, children: ReactNode }

function useResponsiveOpen(compact: boolean) {
  const [wasCompact, setWasCompact] = useState(compact)
  const [open, setOpen] = useState(false)
  // Close while adapting to the breakpoint; do not carry a drawer into desktop menus.
  if (compact !== wasCompact) {
    setWasCompact(compact)
    setOpen(false)
  }
  return [open, setOpen] as const
}

export function useBlockActions(compact: boolean): BlockActionsModel {
  const media = use(EditorMediaContext)
  const editor = useBlockNoteEditor<
    typeof editorSchema.blockSchema,
    typeof editorSchema.inlineContentSchema,
    typeof editorSchema.styleSchema
  >()
  const sideMenu = useExtension(SideMenuExtension)
  const [open, setOpen] = useResponsiveOpen(compact)
  const frozenRef = useRef(false)
  const [id, setId] = useState<string>()
  const [page, setPage] = useState<'actions' | 'colors'>('actions')
  // Frozen side-menu state retains the original block snapshot; read live colors from the editor.
  const block = useEditorState({
    editor,
    on: 'change',
    selector: () => id === undefined ? undefined : editor.getBlock(id),
  })
  const context = useMemo(() => ({
    open,
    show: (target: string): void => {
      sideMenu.freezeMenu()
      frozenRef.current = true
      setId(target)
      setPage('actions')
      setOpen(true)
    },
  }), [
    open,
    sideMenu,
    setOpen,
  ])
  useEffect(() => () => {
    if (frozenRef.current) {
      frozenRef.current = false
      sideMenu.unfreezeMenu()
    }
  }, [sideMenu])
  return {
    editor,
    block,
    open,
    setOpen,
    page,
    setPage,
    context,
    finishClose: (restoreFocus = true): void => {
      // Release the target after the drawer's focus scope and exit animation finish.
      if (frozenRef.current) {
        frozenRef.current = false
        sideMenu.unfreezeMenu()
      }
      if (restoreFocus && media?.isOpen() !== true) {
        editor.focus()
      }
    },
  }
}
