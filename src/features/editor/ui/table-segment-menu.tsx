import type { CSSProperties, ReactNode } from 'react'
import type { TableEditor, TableTarget } from '@/features/editor/ui/table-controls-model'
import type { TableDragControls } from '@/features/editor/ui/table-drag-controls'
import type { TableKeyboardControls } from '@/features/editor/ui/table-keyboard-controls'
import { TableHandlesExtension } from '@blocknote/core/extensions'
import { useDictionary } from '@blocknote/react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  PanelLeft,
  PanelTop,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { menuClass, menuItemClass } from '@/components/ui/ztd-me/ui/classes'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { withNativeTable } from '@/features/editor/ui/table-controls-model'
import { tableDisabledItemClass } from '@/features/editor/ui/table-controls-utilities'
import { TableMoveMenuItems } from '@/features/editor/ui/table-move-menu'
import { canStartTableMove, tableMoveRequest } from '@/features/editor/ui/table-move-operation'
import { addTableSegment, canRemoveTableSegment, tableAxisSpan } from '@/features/editor/ui/table-operations'
import { TableSegmentTrigger } from '@/features/editor/ui/table-segment-trigger'
import { useBlogTranslation } from '@/i18n/use-translation'

export type SegmentProps = {
  editor: TableEditor
  target: TableTarget
  orientation: 'row' | 'column'
  index: number
  position: number
  count: number
  size: number
  last: boolean
  disabled: boolean
  portalElement: HTMLElement | null
  keyboard: TableKeyboardControls
  drag: TableDragControls
  onOpenChange: (open: boolean) => void
  compactHandle?: { selected: boolean, style: CSSProperties }
}

export function TableSegmentMenu(props: SegmentProps): ReactNode {
  const { editor, target, orientation, onOpenChange } = props
  const label = useTableSegmentLabel(props)
  const handles = editor.getExtension(TableHandlesExtension)
  const [open, setOpen] = useState(false)
  const text = useBlogTranslation('editor').t
  const request = tableMoveRequest(editor, target, orientation, props.position)
  const draggable = !props.disabled && canStartTableMove(editor, target, request)
  const changeOpen = (next: boolean): void => {
    setOpen(next)
    onOpenChange(next)
    if (next) {
      handles?.freezeHandles()
    }
    else {
      handles?.unfreezeHandles()
    }
  }
  return (
    <Menu.Root
      modal={false}
      open={open}
      onOpenChange={changeOpen}
    >
      <Menu.Trigger asChild>
        <TableSegmentTrigger
          label={label}
          orientation={orientation}
          position={props.position}
          size={props.size}
          last={props.last}
          disabled={props.disabled}
          compactHandle={props.compactHandle}
          data-table-draggable={draggable}
          aria-description={draggable ? text('tableDragHelp') : undefined}
          title={`${label} · ${text(draggable ? 'tableDragHelp' : 'tableDragBlocked')}`}
          onPointerDown={event => props.drag.begin(event, request, () => changeOpen(!open))}
          onContextMenu={event => event.preventDefault()}
          onClick={(event) => {
            if (event.detail !== 0) {
              event.preventDefault()
              return
            }
            changeOpen(!open)
          }}
        />
      </Menu.Trigger>
      <TableSegmentContent {...props} />
    </Menu.Root>
  )
}

function TableSegmentContent(props: SegmentProps): ReactNode {
  const { editor, target, orientation, portalElement, keyboard } = props
  const row = orientation === 'row'
  return (
    <Menu.Portal container={portalElement ?? undefined}>
      <Menu.Content
        className={cn(menuClass, 'bn-table-handle-menu z-[150] w-56 max-w-[calc(100vw-2rem)] outline-none')}
        side={row ? 'right' : 'bottom'}
        align="start"
        sideOffset={!row && props.compactHandle !== undefined ? 16 : 6}
        collisionPadding={12}
        data-table-menu-for={target.id}
        onEscapeKeyDown={() => keyboard.escapeMenu(target)}
        onCloseAutoFocus={(event) => {
          if (keyboard.closeMenu(target, event)) {
            return
          }
          if (editor.isFocused()) {
            event.preventDefault()
          }
        }}
      >
        <TableMenuItems {...props} />
      </Menu.Content>
    </Menu.Portal>
  )
}

function TableMenuItems(props: SegmentProps): ReactNode {
  const { target, orientation, index, count, disabled } = props
  const dictionary = useDictionary()
  const row = orientation === 'row'
  const full = count >= (row ? 100 : 20)
  const removalAllowed = canRemoveTableSegment(target, orientation, index, count)
  return (
    <>
      <Menu.Item
        className={cn(menuItemClass, tableDisabledItemClass)}
        disabled={disabled || full}
        onSelect={() => addSegment(props, true)}
      >
        {row ? <ArrowUp size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />}
        {row ? dictionary.table_handle.add_above_menuitem : dictionary.table_handle.add_left_menuitem}
      </Menu.Item>
      <Menu.Item
        className={cn(menuItemClass, tableDisabledItemClass)}
        disabled={disabled || full}
        onSelect={() => addSegment(props, false)}
      >
        {row ? <ArrowDown size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
        {row ? dictionary.table_handle.add_below_menuitem : dictionary.table_handle.add_right_menuitem}
      </Menu.Item>
      <TableHeaderItem {...props} />
      <TableMoveMenuItems {...props} />
      <Menu.Separator className="my-1 h-px bg-border" />
      <Menu.Item
        className={cn(menuItemClass, tableDisabledItemClass, 'text-destructive')}
        disabled={disabled || !removalAllowed}
        onSelect={() => removeSegment(props)}
      >
        <Trash2 size={16} aria-hidden="true" />
        {row ? dictionary.table_handle.delete_row_menuitem : dictionary.table_handle.delete_column_menuitem}
      </Menu.Item>
    </>
  )
}

function TableHeaderItem({ editor, target, orientation, index, disabled }: SegmentProps): ReactNode {
  const dictionary = useDictionary()
  const block = editor.getBlock(target.id)
  if (index !== 0 || !editor.settings.tables.headers || block?.type !== 'table') {
    return null
  }
  const row = orientation === 'row'
  const checked = Boolean(row ? block.content.headerRows : block.content.headerCols)
  return (
    <Menu.CheckboxItem
      className={cn(menuItemClass, tableDisabledItemClass)}
      checked={checked}
      disabled={disabled}
      onSelect={() => withNativeTable(editor, target, () => {
        editor.updateBlock(block, {
          content: {
            ...block.content,
            ...(row ? { headerRows: checked ? undefined : 1 } : { headerCols: checked ? undefined : 1 }),
          },
        })
      })}
    >
      {row ? <PanelTop size={16} aria-hidden="true" /> : <PanelLeft size={16} aria-hidden="true" />}
      {row ? dictionary.drag_handle.header_row_menuitem : dictionary.drag_handle.header_column_menuitem}
      <Menu.ItemIndicator className="absolute end-2"><Check size={14} aria-hidden="true" /></Menu.ItemIndicator>
    </Menu.CheckboxItem>
  )
}

function addSegment(props: SegmentProps, before: boolean): void {
  addTableSegment(props, before)
}

function removeSegment(props: SegmentProps): void {
  const { editor, target, orientation, index, disabled } = props
  withNativeTable(editor, target, () => {
    const current = editor.getBlock(target.id)
    if (current?.type !== 'table' || disabled) {
      return
    }
    const count = orientation === 'row' ? current.content.rows.length : current.content.columnWidths.length
    if (canRemoveTableSegment(target, orientation, index, count)) {
      editor.getExtension(TableHandlesExtension)?.removeRowOrColumn(index, orientation)
    }
  })
}

function useTableSegmentLabel({ target, orientation, index, position }: SegmentProps): string {
  const text = useBlogTranslation('editor').t
  const row = orientation === 'row'
  const span = tableAxisSpan(target, orientation, index)
  if (span > 1) {
    return text(row ? 'tableRowsOptions' : 'tableColumnsOptions', { first: position + 1, last: position + span })
  }
  return text(row ? 'tableRowOptions' : 'tableColumnOptions', { number: position + 1 })
}
