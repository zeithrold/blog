import type { ReactNode } from 'react'
import type { Workspace } from '@/features/editor/core/editor-types'
import type { TableEditor, TableTarget } from '@/features/editor/ui/table-controls-model'
import type { TableKeyboardControls } from '@/features/editor/ui/table-keyboard-controls'
import { TableHandlesController } from '@blocknote/react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { TableBar } from '@/features/editor/ui/table-bars'
import { TableCaption } from '@/features/editor/ui/table-caption'
import { useTableCell } from '@/features/editor/ui/table-cell-controls'
import { useTableActivity, useTableGeometry, useTableTargets } from '@/features/editor/ui/table-controls-model'
import { useTableDrag } from '@/features/editor/ui/table-drag-controls'
import { TableDragPreview } from '@/features/editor/ui/table-drag-preview'
import { useTableKeyboardControls } from '@/features/editor/ui/table-keyboard-controls'
import { TableScrollbar } from '@/features/editor/ui/table-scrollbar'
import { useCompactLayout } from '@/hooks/use-compact-layout'
import { useBlogTranslation } from '@/i18n/use-translation'

type ControlProps = {
  workspace: Workspace
  editor: TableEditor
  disabled: boolean
  portalElement: HTMLElement | null
}

function EmptyTableControl(): null {
  return null
}

export function EditorTableControls(props: ControlProps): ReactNode {
  const compact = useCompactLayout(700)
  const targets = useTableTargets(props.editor)
  const cell = useTableCell(props.editor, compact, targets)
  const keyboard = useTableKeyboardControls(props.editor, targets, props.disabled)
  return (
    <>
      <TableHandlesController
        tableHandle={EmptyTableControl}
        extendButton={EmptyTableControl}
        portalElement={props.portalElement ?? undefined}
      />
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
  const text = useBlogTranslation('editor').t
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
      <span className="sr-only" role="status" aria-live="polite">
        {drag.active && text('tableDragging')}
        {!drag.active && drag.selected !== null && text(
          drag.selected.orientation === 'row' ? 'tableRowMoved' : 'tableColumnMoved',
          { number: drag.selected.from + 1 },
        )}
      </span>
    </div>
  )
}
