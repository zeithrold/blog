import type { DocumentModel } from '@/features/editor/workspace/document-model'
import { isTableCellSelection } from '@blocknote/core'
import { TextSelection } from 'prosemirror-state'

type Editor = DocumentModel['editor']
export type LinkTarget = {
  mode: 'create' | 'edit'
  url: string
  text: string
  range: { from: number, to: number }
  document: Editor['prosemirrorState']['doc']
}

export function sameLinkTarget(left: LinkTarget | null, right: LinkTarget | null): boolean {
  return left === right || (left !== null && right !== null
    && left.document === right.document && left.range.from === right.range.from && left.range.to === right.range.to
    && left.url === right.url && left.text === right.text)
}

export function selectedLinkTarget(editor: Editor): LinkTarget | null {
  const state = editor.prosemirrorState
  const range = state.selection
  const text = editor.getSelectedText()
  if (range.empty || isTableCellSelection(range) || text === '') {
    return null
  }
  return {
    mode: 'create',
    url: editor.getSelectedLinkUrl() ?? '',
    text,
    range: { from: range.from, to: range.to },
    document: state.doc,
  }
}

export function currentLinkTarget(editor: Editor): LinkTarget | null {
  const dom = editor.domElement
  const selection = dom?.ownerDocument.getSelection()
  return selection?.isCollapsed === false && dom?.contains(selection.anchorNode) === true
    ? selectedLinkTarget(editor)
    : null
}

export function applyLinkTarget(editor: Editor, target: LinkTarget, url: string, text: string): boolean {
  if (!editor.isEditable || editor.prosemirrorState.doc !== target.document
    || (target.mode === 'edit' && text.trim() === '')) {
    return false
  }
  editor.transact((transaction) => {
    transaction.setSelection(TextSelection.create(transaction.doc, target.range.from, target.range.to))
    // Use the captured range, including at boundaries between adjacent links.
    // Native editLink expands a position into a neighboring whole link.
    editor.createLink(url, target.mode === 'edit' && text !== target.text ? text : undefined)
  })
  return true
}

export function removeLinkRange(editor: Editor, range: LinkTarget['range']): void {
  const mark = editor.pmSchema.marks.link
  if (editor.isEditable && mark !== undefined) {
    editor.transact(transaction => transaction.removeMark(range.from, range.to, mark).setMeta('preventAutolink', true))
  }
}
