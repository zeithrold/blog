import type { RefObject } from 'react'
import type { TableEditor, TableTarget } from '@/features/editor/ui/table-controls-model'
import { useEditorDOMElement } from '@blocknote/react'
import { TextSelection } from 'prosemirror-state'
import { useCallback, useEffect, useRef } from 'react'

type KeyboardSession = {
  target: TableTarget
  document: TableEditor['prosemirrorState']['doc']
  bookmark: ReturnType<TableEditor['prosemirrorState']['selection']['getBookmark']>
  escaping: boolean
}
export type TableKeyboardControls = {
  escapeMenu: (target: TableTarget) => void
  closeMenu: (target: TableTarget, event: Event) => boolean
}

function selectedCell(editor: TableEditor): HTMLTableCellElement | null {
  const { node } = editor.prosemirrorView.domAtPos(editor.prosemirrorState.selection.head)
  const element = node instanceof Element ? node : node.parentElement
  return element?.closest<HTMLTableCellElement>('td,th') ?? null
}

function columnControl(target: TableTarget, cell: HTMLTableCellElement): HTMLButtonElement | null {
  const controls = target.widgets.querySelectorAll<HTMLButtonElement>('[data-table-control-column]')
  const cells = Array.from(target.table.rows.item(0)?.cells ?? [])
  const left = cell.getBoundingClientRect().left + 1
  const match = cells.findIndex(firstRowCell => firstRowCell.getBoundingClientRect().right > left)
  // A first-row merged cell represents its whole rendered column group.
  const index = match < 0 ? cells.length - 1 : match
  return controls.item(Math.max(0, Math.min(controls.length - 1, index)))
}

function restoreCell(editor: TableEditor, session: KeyboardSession): void {
  if (!editor.isEditable || !session.target.table.isConnected) {
    return
  }
  if (editor.prosemirrorState.doc.eq(session.document)) {
    editor.transact(transaction => transaction.setSelection(session.bookmark.resolve(transaction.doc)))
  }
  editor.focus()
}

function cellBookmark(editor: TableEditor, target: TableTarget): KeyboardSession['bookmark'] {
  const { selection, doc } = editor.prosemirrorState
  const caret = window.getSelection()
  if (selection instanceof TextSelection && caret?.anchorNode !== null && caret?.anchorNode !== undefined
    && caret.focusNode !== null && target.table.contains(caret.anchorNode) && target.table.contains(caret.focusNode)) {
    // Browser arrow keys can move the visible caret before ProseMirror reads it.
    // Capture that live range before moving focus into the table controls.
    const view = editor.prosemirrorView
    return TextSelection.between(
      doc.resolve(view.posAtDOM(caret.anchorNode, caret.anchorOffset)),
      doc.resolve(view.posAtDOM(caret.focusNode, caret.focusOffset)),
    ).getBookmark()
  }
  return selection.getBookmark()
}

function isTableShortcut(event: KeyboardEvent): boolean {
  return event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key === 'F10'
}

function focusStaysInTable(event: FocusEvent, target: TableTarget): boolean {
  const focused = event.target
  return focused instanceof Element && (target.wrapper.contains(focused)
    || focused.closest('[data-table-menu-for]')?.getAttribute('data-table-menu-for') === target.id)
}

type KeyboardContext = {
  editor: TableEditor
  targets: TableTarget[]
  session: RefObject<KeyboardSession | null>
}

function enterTableControls(event: KeyboardEvent, { editor, targets, session }: KeyboardContext): void {
  if (!isTableShortcut(event) || !canEnterControls(event, editor)) {
    return
  }
  const cell = selectedCell(editor)
  const target = targets.find(candidate => candidate.table === cell?.closest('table'))
  const control = target === undefined || cell === null ? null : columnControl(target, cell)
  if (target === undefined || control === null || control.disabled) {
    return
  }
  event.preventDefault()
  event.stopImmediatePropagation()
  session.current = {
    target,
    document: editor.prosemirrorState.doc,
    bookmark: cellBookmark(editor, target),
    escaping: false,
  }
  control.focus({ preventScroll: true })
}

function canEnterControls(event: KeyboardEvent, editor: TableEditor): boolean {
  return !event.defaultPrevented && !event.isComposing && !editor.prosemirrorView.composing
    && editor.isEditable && editor.isFocused()
}

function listenForTableKeys(dom: HTMLElement | null | undefined, context: KeyboardContext): () => void {
  const { editor, targets, session } = context
  const enter = (event: KeyboardEvent): void => enterTableControls(event, context)
  const focus = (event: FocusEvent): void => {
    const current = session.current
    if (current !== null && !focusStaysInTable(event, current.target)) {
      session.current = null
    }
  }
  const leave = (event: KeyboardEvent): void => {
    const current = session.current
    if (event.key === 'Escape' && current !== null) {
      event.preventDefault()
      event.stopPropagation()
      session.current = null
      restoreCell(editor, current)
    }
  }
  // Native keydown first synchronizes the DOM caret into ProseMirror state.
  dom?.addEventListener('keydown', enter)
  document.addEventListener('focusin', focus)
  targets.forEach((target) => {
    target.widgets.addEventListener('keydown', leave)
  })
  return () => {
    dom?.removeEventListener('keydown', enter)
    document.removeEventListener('focusin', focus)
    targets.forEach((target) => {
      target.widgets.removeEventListener('keydown', leave)
    })
    session.current = null
  }
}

export function useTableKeyboardControls(
  editor: TableEditor,
  targets: TableTarget[],
  disabled: boolean,
): TableKeyboardControls {
  const dom = useEditorDOMElement()
  const sessionRef = useRef<KeyboardSession | null>(null)
  useEffect(() => {
    if (disabled) {
      sessionRef.current = null
      return
    }
    return listenForTableKeys(dom, { editor, targets, session: sessionRef })
  }, [
    disabled,
    dom,
    editor,
    targets,
  ])
  const escapeMenu = useCallback((target: TableTarget): void => {
    if (sessionRef.current?.target.id === target.id) {
      sessionRef.current.escaping = true
    }
  }, [])
  const closeMenu = useCallback((target: TableTarget, event: Event): boolean => {
    const session = sessionRef.current
    if (session?.target.id !== target.id) {
      return false
    }
    sessionRef.current = null
    if (!session.escaping) {
      return false
    }
    event.preventDefault()
    restoreCell(editor, session)
    return true
  }, [editor])
  return { escapeMenu, closeMenu }
}
