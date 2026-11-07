import type { Selection } from 'prosemirror-state'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { getBlockInfo, getNodeById } from '@blocknote/core'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import { isPlainBlockSelection } from '@/features/editor/blocks/source/source-selection'

export type ContextEditor = Workspace['model']['editor']
export type ContextTarget = {
  readonly id: string
  readonly document: ContextEditor['prosemirrorState']['doc']
  readonly bookmark: ReturnType<Selection['getBookmark']>
  readonly text: boolean
  readonly cell: HTMLTableCellElement | null
}

export function contextSelection(editor: ContextEditor): Selection {
  const { selection, doc } = editor.prosemirrorState
  const dom = editor.prosemirrorView.dom
  const range = dom.ownerDocument.getSelection()
  if (selection instanceof TextSelection && range !== null && range.anchorNode !== null && range.focusNode !== null
    && dom.contains(range.anchorNode) && dom.contains(range.focusNode)) {
    return TextSelection.between(
      doc.resolve(editor.prosemirrorView.posAtDOM(range.anchorNode, range.anchorOffset)),
      doc.resolve(editor.prosemirrorView.posAtDOM(range.focusNode, range.focusOffset)),
    )
  }
  return selection
}

type ContextInput = {
  readonly element: Element
  readonly point: { left: number, top: number }
  readonly previous: Selection
  readonly keyboard: boolean
}

function contextHit(editor: ContextEditor, { element, point, previous, keyboard }: ContextInput) {
  const view = editor.prosemirrorView
  const hit = view.posAtCoords(point)
  const id = keyboard
    ? editor.getTextCursorPosition().block.id
    : element.closest<HTMLElement>('.bn-block-outer[data-id]')?.dataset.id
  if (hit === null || id === undefined || editor.getBlock(id) === undefined) {
    return null
  }
  const dom = keyboard ? view.domAtPos(previous.head).node : element
  const scoped = dom instanceof Element ? dom : dom.parentElement
  const cell = scoped?.closest<HTMLTableCellElement>('td,th') ?? null
  return { id, position: hit.pos, cell }
}

export function captureContextTarget(editor: ContextEditor, input: ContextInput): ContextTarget | null {
  const hit = contextHit(editor, input)
  if (hit === null) {
    return null
  }
  const { id, position, cell } = hit
  const { previous, keyboard } = input
  const view = editor.prosemirrorView
  const preserved = previous.$from.doc === view.state.doc
    && previous.ranges.some(range => position >= range.$from.pos && position <= range.$to.pos)
  const selection = preserved || keyboard ? previous : clickedSelection(editor, id, position, cell !== null)
  if (selection === null) {
    return null
  }
  editor.transact(transaction => transaction.setSelection(selection.getBookmark().resolve(transaction.doc)))
  return {
    id,
    document: editor.prosemirrorState.doc,
    bookmark: editor.prosemirrorState.selection.getBookmark(),
    text: !selection.empty && editor.getSelectedText() !== '' && !isPlainBlockSelection(editor),
    cell,
  }
}

function clickedSelection(editor: ContextEditor, id: string, position: number, cell: boolean): Selection | null {
  const { doc } = editor.prosemirrorState
  const node = getNodeById(id, doc)
  if (node !== undefined) {
    const info = getBlockInfo(node)
    if (info.isBlockContainer) {
      const start = info.blockContent.beforePos
      const content = doc.nodeAt(start)
      if (content === null) {
        return null
      }
      if (!content.isTextblock && !cell) {
        return NodeSelection.create(doc, start)
      }
      return TextSelection.near(doc.resolve(Math.max(start + 1, Math.min(position, start + content.nodeSize - 1))))
    }
  }
  return null
}

export function restoreContextTarget(editor: ContextEditor, target: ContextTarget): boolean {
  if (!editor.prosemirrorState.doc.eq(target.document)) {
    return false
  }
  editor.transact(transaction => transaction.setSelection(target.bookmark.resolve(transaction.doc)))
  return true
}
