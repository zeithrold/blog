import type { SourceWithPreviewProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import type { editorSchema } from '@/features/editor/engine/schema'
import { useEditorState } from '@blocknote/react'
import { Pencil } from 'lucide-react'
import { NodeSelection } from 'prosemirror-state'
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { Button } from '@/components/ui/ztd-me/client'
import { sourceInputEvents } from '@/features/editor/blocks/source/source-input'
import { isPlainBlockSelection as sourceSelection } from '@/features/editor/blocks/source/source-selection'
import { useBlogTranslation } from '@/i18n/use-translation'

const layout1Class = [
  'relative w-full min-w-0 rounded-xl border border-border bg-surface px-4 py-3 font-sans',
  'data-[source-focused=false]:after:bg-transparent data-[source-focused=false]:after:shadow-none',
].join(' ')

const sourceInputClass = [
  'relative m-0 max-h-64 min-h-22 overflow-auto rounded-lg border border-border bg-background',
  'px-3 py-2 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words',
].join(' ')

const sourcePlaceholderClass = [
  'before:pointer-events-none before:absolute before:inset-x-3 before:top-2',
  'before:truncate before:text-muted-foreground before:content-[attr(data-placeholder)]',
].join(' ')

const sourcePanelClass = [
  'static mt-0 h-auto w-full rounded-none border-0 bg-transparent text-foreground shadow-none',
].join(' ')

type Editor = typeof editorSchema.BlockNoteEditor
// BlockNote remounts node views when publication switches the editor's editable
// state. Keep presentation state with the editor rather than losing it on remount.
const visibleSources = new WeakMap<Editor, Set<string>>()

function useSourceVisibility(editor: Editor, blockId: string) {
  const [open, setOpen] = useState(() => visibleSources.get(editor)?.has(blockId) ?? false)
  const changeOpen = useCallback((value: boolean): void => {
    const ids = visibleSources.get(editor) ?? new Set<string>()
    if (value) {
      ids.add(blockId)
    }
    else {
      ids.delete(blockId)
    }
    visibleSources.set(editor, ids)
    setOpen(value)
  }, [editor, blockId])
  return { open, setOpen: changeOpen }
}

function useSourceSelection(editor: Editor, blockId: string) {
  const selector = (): 'outside' | 'text' | 'node' => {
    if (editor.getTextCursorPosition().block.id !== blockId) {
      return 'outside'
    }
    const selection = editor.prosemirrorState.selection
    if (selection instanceof NodeSelection) {
      return 'node'
    }
    return sourceSelection(editor) ? 'text' : 'outside'
  }
  const mode = useEditorState({ editor, on: 'selection', selector })
  const subscribe = useCallback((notify: () => void) => editor.onFocusChange(() => notify()), [editor])
  const focused = useSyncExternalStore(subscribe, () => editor.isFocused(), () => false)
  return { mode, focused }
}
function useSourceDismiss(
  editor: Editor,
  blockId: string,
  outside: boolean,
  { open, setOpen }: ReturnType<typeof useSourceVisibility>,
): void {
  useEffect(() => {
    if (!outside || !open) {
      return
    }
    // Let focus and native selection settle before closing. A click on another
    // control must not hide source while WebKit is restoring its previous caret.
    const frame = requestAnimationFrame(() => {
      if (editor.isEditable && editor.prosemirrorView.hasFocus()
        && editor.getTextCursorPosition().block.id !== blockId) {
        setOpen(false)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [
    outside,
    open,
    editor,
    blockId,
    setOpen,
  ])
}
function useSourcePopup(editor: Editor, blockId: string) {
  const visibility = useSourceVisibility(editor, blockId)
  const { open, setOpen } = visibility
  const { mode, focused } = useSourceSelection(editor, blockId)
  // A writing caret inside source must always have a visible editor, including
  // when arrow navigation enters an existing formula or diagram.
  if (!open && mode === 'text' && focused && editor.isEditable) {
    setOpen(true)
  }
  useSourceDismiss(editor, blockId, mode === 'outside', visibility)
  const popup = useMemo(() => ({
    isOpen: open,
    isSelected: mode === 'node' && focused && !open,
    focused,
    reveal: (): void => setOpen(true),
    open: (): void => {
      if (!editor.isEditable) {
        return
      }
      // WebKit cannot place a native caret in the still-hidden source element.
      // eslint-disable-next-line react/dom-no-flush-sync -- Reveal source before moving its native caret.
      flushSync(() => setOpen(true))
      editor.focus()
      editor.setTextCursorPosition(blockId, 'end')
    },
    close: (): void => {
      setOpen(false)
      if (!editor.isEditable) {
        return
      }
      // Keep the caret outside the hidden source after closing its editor.
      const next = editor.getNextBlock(blockId) ?? editor.getPrevBlock(blockId)
        ?? editor.insertBlocks([
          { type: 'paragraph' },
        ], blockId, 'after')[0]
      if (next !== undefined) {
        editor.focus()
        editor.setTextCursorPosition(next.id, 'start')
      }
    },
  }), [
    editor,
    blockId,
    open,
    mode,
    focused,
    setOpen,
  ])
  useSourceEvents(editor, blockId, popup)
  return popup
}
function useSourceEvents(editor: Editor, blockId: string, popup: ReturnType<typeof useSourcePopup>): void {
  useEffect(() => {
    const element = editor.domElement
    const events = sourceInputEvents(editor, blockId, popup)
    element?.addEventListener('keydown', events.keydown, true)
    element?.addEventListener('compositionstart', events.compositionstart, true)
    element?.addEventListener('paste', events.paste, true)
    element?.addEventListener('beforeinput', events.beforeinput, true)
    return () => {
      element?.removeEventListener('keydown', events.keydown, true)
      element?.removeEventListener('compositionstart', events.compositionstart, true)
      element?.removeEventListener('paste', events.paste, true)
      element?.removeEventListener('beforeinput', events.beforeinput, true)
    }
  }, [
    editor,
    blockId,
    popup,
  ])
}
export function SourceBlockView({
  editor,
  blockId,
  label,
  children,
  className = '',
  compact = false,
  ...source
}: SourceWithPreviewProps & {
  editor: Editor
  blockId: string
  label: string
  children?: ReactNode
  className?: string
  compact?: boolean
}): ReactNode {
  const text = useBlogTranslation('editor').t
  const popup = useSourcePopup(editor, blockId)
  const compactHeader = compact ? 'absolute end-2 top-2 z-10' : ''
  return (
    <div
      className={`${layout1Class} ${compact ? 'source-compact' : ''} ${className}`}
      data-source-focused={popup.focused}
    >
      <div
        contentEditable={false}
        className={`flex items-center justify-between gap-3 text-xs text-muted-foreground ${compactHeader}`}
      >
        <span className={compact ? 'sr-only' : undefined}>{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={compact ? 'border-border bg-surface' : undefined}
          aria-label={label}
          data-publication-editor=""
          disabled={!editor.isEditable}
          onPointerDownCapture={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={popup.open}
        >
          <Pencil size={16} aria-hidden="true" />
        </Button>
      </div>
      <div
        className={`bn-preview-with-source-popup grid gap-3 p-0 ${popup.isSelected ? 'ProseMirror-selectednode' : ''}`}
        data-open={popup.isOpen}
      >
        <SourcePreview {...source} popup={popup} editable={editor.isEditable} />
        <SourceEditor {...source} popup={popup} done={text('done')}>
          {popup.isOpen ? children : undefined}
        </SourceEditor>
      </div>
    </div>
  )
}

function SourcePreview({ source, preview, emptySourcePlaceholder, popup, editable }: SourceWithPreviewProps & {
  popup: ReturnType<typeof useSourcePopup>
  editable: boolean
}): ReactNode {
  if (source.length === 0 && popup.isOpen) {
    return null
  }
  return (
    <div contentEditable={false} className="bn-preview-container min-h-14 py-2">
      {source.length === 0
        ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-muted-foreground"
              disabled={!editable}
              onClick={popup.open}
            >
              {emptySourcePlaceholder}
            </Button>
          )
        : preview}
    </div>
  )
}

function SourceEditor({ contentRef, source, sourcePlaceholder, popup, done, children }: SourceWithPreviewProps & {
  popup: ReturnType<typeof useSourcePopup>
  done: string
  children?: ReactNode
}): ReactNode {
  return (
    <div
      className={`bn-source-block-popup ${popup.isOpen ? sourcePanelClass : ''}`}
      aria-hidden={!popup.isOpen || undefined}
    >
      <pre
        className={`${sourceInputClass} ${source.length === 0 ? sourcePlaceholderClass : ''}`}
        data-placeholder={sourcePlaceholder}
        aria-hidden={!popup.isOpen || undefined}
      >
        <code ref={contentRef} role="textbox" aria-label={sourcePlaceholder} aria-multiline="true" />
      </pre>
      {children !== undefined && <div contentEditable={false} className="mt-3 grid gap-4">{children}</div>}
      <div contentEditable={false} inert={!popup.isOpen} className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          data-source-done=""
          onPointerDownCapture={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.stopPropagation()
            popup.close()
          }}
        >
          {done}
        </Button>
      </div>
    </div>
  )
}
