import type { ReactNode, RefObject } from 'react'
import type { LinkTarget } from '@/features/editor/core/link-target'
import type { EditorPopoverFocus } from '@/features/editor/ui/popover-focus'
import { ShowSelectionExtension } from '@blocknote/core/extensions'
import { useDictionary, useEditorDOMElement, useEditorState, useExtension } from '@blocknote/react'
import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  useFrontendPreferences,
} from '@/components/ui/ztd-me/client'
import { currentLinkTarget } from '@/features/editor/core/link-target'
import { EditorLinkContext } from '@/features/editor/ui/link-context'
import { LinkEditorForm } from '@/features/editor/ui/link-form'
import { useEditorPopoverFocus } from '@/features/editor/ui/popover-focus'
import { useRichEditor } from '@/features/editor/ui/use-rich-editor'

export function EditorLinkCommands({ children, compact, disabled, composingRef }: {
  children: ReactNode
  compact: boolean
  disabled: boolean
  composingRef: RefObject<boolean>
}): ReactNode {
  const editor = useRichEditor()
  const selection = useExtension(ShowSelectionExtension)
  const document = useEditorState({
    editor,
    on: 'change',
    selector: () => editor.prosemirrorState.doc,
    equalityFn: Object.is,
  })
  const [state, setState] = useState<{
    editor: typeof editor
    compact: boolean
    disabled: boolean
    target: LinkTarget | null
  }>(
    { editor, compact, disabled, target: null },
  )
  if (state.editor !== editor || state.compact !== compact || state.disabled !== disabled) {
    setState({ editor, compact, disabled, target: null })
  }
  const target = state.target
  const open = !disabled && target !== null
  const show = useCallback((next: LinkTarget): void => {
    if (!disabled && editor.isEditable && !composingRef.current && next.document === editor.prosemirrorState.doc) {
      setState(current => current.target === null ? { editor, compact, disabled, target: next } : current)
    }
  }, [
    compact,
    disabled,
    composingRef,
    editor,
  ])
  useLinkShortcut(disabled, composingRef, show)
  useEffect(() => {
    selection.showSelection(open, 'editorLink')
    return () => selection.showSelection(false, 'editorLink')
  }, [selection, open])
  const close = (): void => setState(current => ({ ...current, target: null }))
  const focus = useEditorPopoverFocus(open, restore => restore && editor.focus())
  return (
    <EditorLinkContext value={show}>
      {children}
      <EditorLinkDialog open={open} target={target} stale={target?.document !== document} close={close} focus={focus} />
    </EditorLinkContext>
  )
}

function EditorLinkDialog({ open, target, stale, close, focus }: {
  open: boolean
  target: LinkTarget | null
  stale: boolean
  close: () => void
  focus: EditorPopoverFocus
}): ReactNode {
  const dictionary = useDictionary()
  const { resolvedMode } = useFrontendPreferences()
  return (
    <Dialog open={open} onOpenChange={value => !value && close()}>
      <DialogContent
        className="editor-link-command blog-editor bn-root max-h-[85dvh] overflow-y-auto"
        data-color-scheme={resolvedMode}
        onOpenAutoFocus={focus.onOpenAutoFocus}
        onCloseAutoFocus={focus.onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>
            {target?.mode === 'edit'
              ? dictionary.link_toolbar.edit.text
              : dictionary.formatting_toolbar.link.tooltip}
          </DialogTitle>
          <DialogDescription className="max-h-24 overflow-y-auto wrap-anywhere">{target?.text}</DialogDescription>
        </DialogHeader>
        {target !== null && <LinkEditorForm target={target} stale={stale} close={close} />}
      </DialogContent>
    </Dialog>
  )
}

function matchesLinkShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k'
}

function useLinkShortcut(
  disabled: boolean,
  composingRef: RefObject<boolean>,
  show: (target: LinkTarget) => void,
): void {
  const editor = useRichEditor()
  const dom = useEditorDOMElement()
  useEffect(() => {
    const handle = (event: KeyboardEvent): void => {
      if (!matchesLinkShortcut(event)) {
        return
      }
      // Ctrl+K otherwise deletes the rest of a line in macOS editable fields.
      event.preventDefault()
      event.stopImmediatePropagation()
      if (disabled || event.isComposing || composingRef.current || !editor.isEditable) {
        return
      }
      const target = currentLinkTarget(editor)
      if (target !== null) {
        show(target)
      }
    }
    dom?.addEventListener('keydown', handle, true)
    return () => dom?.removeEventListener('keydown', handle, true)
  }, [
    disabled,
    composingRef,
    dom,
    editor,
    show,
  ])
}
