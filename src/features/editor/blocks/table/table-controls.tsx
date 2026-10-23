import type { ReactNode } from 'react'
import type { TableEditor, TableTarget } from '@/features/editor/blocks/table/table-controls-model'
import type { TableKeyboardControls } from '@/features/editor/blocks/table/table-keyboard-controls'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { TableBar } from '@/features/editor/blocks/table/table-bars'
import { TableCaption } from '@/features/editor/blocks/table/table-caption'
import { useTableCell } from '@/features/editor/blocks/table/table-cell-controls'
import {
  useTableActivity,
  useTableGeometry,
  useTableTargets,
} from '@/features/editor/blocks/table/table-controls-model'
import { useTableDrag } from '@/features/editor/blocks/table/table-drag-controls'
import { TableDragPreview } from '@/features/editor/blocks/table/table-drag-preview'
import { useTableKeyboardControls } from '@/features/editor/blocks/table/table-keyboard-controls'
import { TableScrollbar } from '@/features/editor/blocks/table/table-scrollbar'
import { useCompactLayout } from '@/hooks/use-compact-layout'
import { useBlogTranslation } from '@/i18n/use-translation'

type ControlProps = {
  workspace: Workspace
  editor: TableEditor
  disabled: boolean
  portalElement: HTMLElement | null
}

export function EditorTableControls(props: ControlProps): ReactNode {
  const compact = useCompactLayout(700)
  const targets = useTableTargets(props.editor)
  const cell = useTableCell(props.editor, compact, targets)
  const keyboard = useTableKeyboardControls(props.editor, targets, props.disabled)
  // Project-owned bars provide the handles. A second native controller creates
  // empty floating elements and duplicate resize observers with this configuration.
  return (
    <>
      {targets.map(target => createPortal(
        <TableControls {...props} keyboard={keyboard} target={target} compact={compact} cell={cell} />,
        target.widgets,
        target.id,
      ))}
    </>
  )
}

function TableControls({
  workspace,
  editor,
  disabled,
  portalElement,
  target,
  keyboard,
  compact,
  cell,
}: ControlProps & {
  target: TableTarget
  keyboard: TableKeyboardControls
  compact: boolean
  cell: HTMLTableCellElement | null
}): ReactNode {
  const geometry = useTableGeometry(target)
  const hoverOrFocus = useTableActivity(target)
  const [menuOpen, setMenuOpen] = useState(false)
  const drag = useTableDrag(editor, target, { disabled, overlay: portalElement })
  const active = !drag.active && (compact || hoverOrFocus || menuOpen)
  const props = {
    editor,
    target,
    geometry,
    compact,
    cell,
    active,
    disabled,
    portalElement,
    keyboard,
    drag,
    onOpenChange: setMenuOpen,
  }
  return (
    <div
      contentEditable={false}
      onMouseDown={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
    >
      <TableBar {...props} orientation="column" />
      <TableBar {...props} orientation="row" />
      <TableScrollbar target={target} geometry={geometry} />
      <TableCaption workspace={workspace} target={target} width={geometry.viewportWidth} />
      <TableDragPreview store={drag.store} portalElement={portalElement} />
      <TableAnnouncement drag={drag} portalElement={portalElement} />
    </div>
  )
}

function TableAnnouncement({ drag, portalElement }: {
  drag: ReturnType<typeof useTableDrag>
  portalElement: HTMLElement | null
}): ReactNode {
  const text = useBlogTranslation('editor').t
  // aria-hidden preserves live regions. Keeping one inside ProseMirror makes
  // modal menus hide individual document blocks, invalidating their node views.
  return portalElement === null
    ? null
    : createPortal(
        <span className="sr-only" role="status" aria-live="polite">
          {drag.active && text('tableDragging')}
          {!drag.active && drag.selected !== null && text(
            drag.selected.orientation === 'row' ? 'tableRowMoved' : 'tableColumnMoved',
            { number: drag.selected.from + 1 },
          )}
        </span>,
        portalElement,
      )
}
