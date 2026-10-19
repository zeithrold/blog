import type { DocumentModel } from '@/features/editor/workspace/document-model'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import { flushSync } from 'react-dom'
import { isPlainBlockSelection as sourceSelection } from '@/features/editor/blocks/source/source-selection'

type Editor = DocumentModel['editor']
type SourcePopup = {
  isOpen: boolean
  reveal: () => void
  open: () => void
  close: () => void
}
type SourceEvents = {
  keydown: (event: KeyboardEvent) => void
  compositionstart: (event: CompositionEvent) => void
  paste: (event: ClipboardEvent) => void
  beforeinput: (event: InputEvent) => void
}

function sourceTarget(event: Event, editor: Editor, blockId: string): boolean {
  const target = event.target
  return editor.isEditable && target instanceof HTMLElement && target.isContentEditable
    && editor.prosemirrorView.dom.contains(target) && target.closest('button,input,textarea,select') === null
    && editor.getTextCursorPosition().block.id === blockId && sourceSelection(editor)
}

function revealBeforeNativeInput(reveal: () => void): void {
  // eslint-disable-next-line react/dom-no-flush-sync -- Reveal editable DOM before native input's default action.
  flushSync(reveal)
}

function enterSource(editor: Editor, popup: SourcePopup): void {
  if (editor.prosemirrorState.selection instanceof NodeSelection) {
    popup.open()
  }
  else if (!popup.isOpen) {
    // Preserve an existing text/IME range without refocusing it.
    revealBeforeNativeInput(popup.reveal)
  }
}

function sourceBeforeInput(event: InputEvent, editor: Editor, popup: SourcePopup): void {
  const node = editor.prosemirrorState.selection instanceof NodeSelection
  if (node && event.inputType.startsWith('delete')) {
    return
  }
  enterSource(editor, popup)
  if (!event.cancelable || event.isComposing) {
    return
  }
  insertSourceInput(event, editor, node)
}

function insertSourceInput(event: InputEvent, editor: Editor, node: boolean): void {
  if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
    event.preventDefault()
    if (!node) {
      editor.transact(transaction => transaction.insertText('\n'))
    }
    return
  }
  if (inputAtBoundary(event, editor)) {
    event.preventDefault()
    return
  }
  const data = event.data
  if (node && event.inputType === 'insertText' && data !== null) {
    event.preventDefault()
    editor.transact(transaction => transaction.insertText(data))
  }
}

function inputAtBoundary(event: InputEvent, editor: Editor): boolean {
  if (!event.inputType.startsWith('delete')) {
    return false
  }
  const selection = editor.prosemirrorState.selection
  const backward = event.inputType.endsWith('Backward') && selection.$from.parentOffset === 0
  const forward = event.inputType.endsWith('Forward')
    && selection.$from.parentOffset === selection.$from.parent.content.size
  return selection.empty && (backward || forward)
}

export function sourceInputEvents(editor: Editor, blockId: string, popup: SourcePopup): SourceEvents {
  return {
    keydown: (event) => {
      if (sourceTarget(event, editor, blockId) && !event.isComposing && !editor.prosemirrorView.composing) {
        sourceKeys(event, editor, popup)
      }
    },
    compositionstart: (event) => {
      if (sourceTarget(event, editor, blockId)) {
        enterSource(editor, popup)
      }
    },
    paste: (event) => {
      if (!event.defaultPrevented && (event.clipboardData?.files.length ?? 0) === 0
        && sourceTarget(event, editor, blockId)) {
        const text = event.clipboardData?.getData('text/plain') ?? ''
        if (text.length > 32768) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        enterSource(editor, popup)
        editor.transact(transaction => transaction.insertText(text))
      }
    },
    beforeinput: (event) => {
      if (!event.defaultPrevented && sourceTarget(event, editor, blockId)) {
        sourceBeforeInput(event, editor, popup)
      }
    },
  }
}

function sourceEnter(event: KeyboardEvent, editor: Editor, popup: SourcePopup): void {
  if (event.key !== 'Escape' && (event.key !== 'Enter' || event.altKey)) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Escape' || event.metaKey || event.ctrlKey) {
    popup.close()
  }
  else {
    editor.transact(transaction => transaction.insertText('\n'))
  }
}

function selectSource(event: KeyboardEvent, editor: Editor): boolean {
  if (event.key.toLowerCase() !== 'a' || event.altKey || (!event.ctrlKey && !event.metaKey)) {
    return false
  }
  const view = editor.prosemirrorView
  const { $from } = view.state.selection
  event.preventDefault()
  event.stopPropagation()
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, $from.start(), $from.end())))
  return true
}

function revealClosedSource(event: KeyboardEvent, editor: Editor, popup: SourcePopup): void {
  if (editor.prosemirrorState.selection instanceof NodeSelection && ['Backspace', 'Delete'].includes(event.key)) {
    return
  }
  const character = event.key.length === 1 && !event.ctrlKey && !event.metaKey
  if (character || [
    'Backspace',
    'Delete',
    'Enter',
    'Tab',
  ].includes(event.key)) {
    event.preventDefault()
    event.stopPropagation()
    enterSource(editor, popup)
    if (character) {
      editor.transact(transaction => transaction.insertText(event.key))
    }
  }
}

function sourceBoundary(event: KeyboardEvent, editor: Editor): boolean {
  const selection = editor.prosemirrorState.selection
  return selection.empty && ((event.key === 'Backspace' && selection.$from.parentOffset === 0)
    || (event.key === 'Delete' && selection.$from.parentOffset === selection.$from.parent.content.size))
}

function sourceKeys(event: KeyboardEvent, editor: Editor, popup: SourcePopup): void {
  if (!popup.isOpen || editor.prosemirrorState.selection instanceof NodeSelection) {
    revealClosedSource(event, editor, popup)
    return
  }
  if (selectSource(event, editor) || sourceTab(event, editor)) {
    return
  }
  sourceEnter(event, editor, popup)
  if (sourceBoundary(event, editor)) {
    event.preventDefault()
    event.stopPropagation()
  }
}

function sourceTab(event: KeyboardEvent, editor: Editor): boolean {
  if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) {
    return false
  }
  const id = editor.getTextCursorPosition().block.id
  const block = editor.domElement?.querySelector(`[data-id="${CSS.escape(id)}"]`)
  const selector = event.shiftKey
    ? '[data-publication-editor]'
    : [
        '.bn-source-block-popup input:not([disabled])',
        '.bn-source-block-popup textarea:not([disabled])',
        '.bn-source-block-popup select:not([disabled])',
        '[data-source-done]',
      ].join(',')
  event.preventDefault()
  event.stopPropagation()
  block?.querySelector<HTMLElement>(selector)?.focus()
  return true
}
