import type { ReactNode } from 'react'
import type { SegmentProps } from '@/features/editor/blocks/table/table-segment-menu'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'
import { menuItemClass } from '@/components/ui/ztd-me/ui/classes'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { tableDisabledItemClass } from '@/features/editor/blocks/table/table-controls-utilities'
import { canFinishTableMove, tableMoveRequest } from '@/features/editor/blocks/table/table-move-operation'
import { useBlogTranslation } from '@/i18n/use-translation'

export function TableMoveMenuItems(props: SegmentProps): ReactNode {
  const { editor, target, orientation, position, disabled, drag } = props
  const text = useBlogTranslation('editor').t
  const row = orientation === 'row'
  return [-1, 1].map((direction) => {
    const request = {
      ...tableMoveRequest(editor, target, orientation, position),
      boundary: direction < 0 ? position - 1 : position + 2,
    }
    const rowLabel = direction < 0 ? 'moveTableRowUp' : 'moveTableRowDown'
    const columnLabel = direction < 0 ? 'moveTableColumnLeft' : 'moveTableColumnRight'
    const label = row ? rowLabel : columnLabel
    const RowIcon = direction < 0 ? ArrowUp : ArrowDown
    const ColumnIcon = direction < 0 ? ArrowLeft : ArrowRight
    const Icon = row ? RowIcon : ColumnIcon
    return (
      <Menu.Item
        key={direction}
        className={cn(menuItemClass, tableDisabledItemClass)}
        disabled={disabled || !canFinishTableMove(editor, target, request)}
        onSelect={() => drag.move(request)}
      >
        <Icon size={16} aria-hidden="true" />
        {text(label)}
      </Menu.Item>
    )
  })
}
