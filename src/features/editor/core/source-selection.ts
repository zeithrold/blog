import type { DocumentModel } from '@/features/editor/core/model'
import { NodeSelection } from 'prosemirror-state'

export function isPlainBlockSelection(editor: DocumentModel['editor']): boolean {
  const selection = editor.prosemirrorState.selection
  return selection instanceof NodeSelection
    ? selection.node.type.spec.content === 'text*'
    : selection.$from.sameParent(selection.$to) && selection.$from.parent.type.spec.content === 'text*'
}
