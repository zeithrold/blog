import type { Workspace } from '@/features/editor/workspace/editor-types'
import { getBlockInfo, getNodeById } from '@blocknote/core'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import { ATOMIC_TYPES } from '@/content/tree'

const selectableFunctionalTypes = new Set([
  ...ATOMIC_TYPES,
  'math',
  'mermaid',
])

export function lastBlockDescendant<Block extends { children: readonly Block[] }>(
  block: Block | undefined,
): Block | undefined {
  let last = block
  while (last !== undefined) {
    const child = last.children.at(-1)
    if (child === undefined) {
      return last
    }
    last = child
  }
  return last
}

export function canSelectPreviousAtomicBlock(input: {
  currentType: string
  previousType: string | undefined
  collapsed: boolean
  offset: number
  composing: boolean
  busy: boolean
}): boolean {
  return !input.busy && !input.composing && input.collapsed && input.offset === 0
    && input.currentType === 'paragraph' && input.previousType !== undefined
    && selectableFunctionalTypes.has(input.previousType)
}

function selectFunctionalBlock(editor: Workspace['model']['editor'], id: string): void {
  const view = editor.prosemirrorView
  const position = getNodeById(id, view.state.doc)
  if (position === undefined) {
    return
  }
  const info = getBlockInfo(position)
  if (info.isBlockContainer) {
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, info.blockContent.beforePos)))
  }
}

function isEditorBodyEvent(event: React.KeyboardEvent, workspace: Workspace): boolean {
  const target = event.target
  const formControl = target instanceof HTMLElement && target.closest('input,textarea,select') !== null
  return target instanceof HTMLElement && target.isContentEditable
    && workspace.model.editor.prosemirrorView.dom.contains(target) && !formControl
}

function ignoreBlockDeletion(event: React.KeyboardEvent, workspace: Workspace): boolean {
  const { model, busy } = workspace
  return event.key !== 'Backspace' || event.altKey || event.ctrlKey || event.metaKey
    || event.nativeEvent.isComposing || model.composingRef.current || busy || !model.editor.isEditable
    || !isEditorBodyEvent(event, workspace)
}

function reconcileCaret(editor: Workspace['model']['editor']): void {
  const view = editor.prosemirrorView
  const domSelection = view.dom.ownerDocument.getSelection()
  if (!view.hasFocus() || domSelection === null || !domSelection.isCollapsed) {
    return
  }
  const anchor = domSelection.anchorNode
  if (anchor === null || !view.dom.contains(anchor)) {
    return
  }
  const position = view.posAtDOM(anchor, domSelection.anchorOffset)
  const { selection, doc } = view.state
  // Focus can temporarily suppress ProseMirror's selection observer. Do not let
  // its old node selection delete a block when the browser caret is now in text.
  if (doc.resolve(position).parent.inlineContent) {
    const caret = TextSelection.create(doc, position)
    if (!selection.eq(caret)) {
      view.dispatch(view.state.tr.setSelection(caret))
    }
  }
}

export function selectBeforeBlockDeletion(
  event: React.KeyboardEvent,
  workspace: Workspace,
  pending: React.RefObject<string | null>,
): void {
  const { model, busy } = workspace
  const { editor, composingRef } = model
  if (ignoreBlockDeletion(event, workspace)) {
    return
  }
  reconcileCaret(editor)
  const selection = editor.prosemirrorState.selection
  if ('node' in selection) {
    const selected = editor.getTextCursorPosition().block
    if (pending.current === selected.id && event.repeat) {
      event.preventDefault()
      event.stopPropagation()
    }
    else {
      pending.current = null
    }
    return
  }
  const { block, prevBlock } = editor.getTextCursorPosition()
  // The native merge command walks the last child of the preceding sibling.
  const previous = lastBlockDescendant(prevBlock)
  if (canSelectPreviousAtomicBlock({
    currentType: block.type,
    previousType: previous?.type,
    collapsed: selection.empty,
    offset: selection.$from.parentOffset,
    composing: composingRef.current,
    busy,
  }) && previous !== undefined) {
    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) {
      pending.current = previous.id
      selectFunctionalBlock(editor, previous.id)
    }
  }
}
