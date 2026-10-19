import type { ComponentProps, ReactNode } from 'react'
import type { SegmentProps } from '@/features/editor/blocks/table/table-segment-menu'
import { GripVertical, MoreHorizontal, MoreVertical } from 'lucide-react'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { tableSegmentClass } from '@/features/editor/blocks/table/table-controls-utilities'

const compactClass = [
  'absolute flex size-11 items-center justify-center text-muted-foreground hover:text-foreground',
  'focus-visible:text-foreground focus-visible:opacity-100',
  'focus-visible:pointer-events-auto focus-visible:outline-none',
  'data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto',
].join(' ')
const gripClass = [
  'flex items-center justify-center rounded-md border border-border bg-surface shadow-sm',
  '[[data-state=open]_&]:bg-muted [[data-state=open]_&]:text-foreground',
  '[button:focus-visible_&]:outline-2 [button:focus-visible_&]:outline-focus',
].join(' ')

type TriggerProps = Pick<SegmentProps, 'orientation' | 'size' | 'last' | 'disabled' | 'compactHandle' | 'position'>
  & ComponentProps<'button'> & { label: string }

function triggerAppearance({ orientation, size, last, compactHandle }: TriggerProps): ComponentProps<'button'> {
  const row = orientation === 'row'
  if (compactHandle !== undefined) {
    return {
      className: cn(
        compactClass,
        compactHandle.selected ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      ),
      style: compactHandle.style,
      tabIndex: compactHandle.selected ? 0 : -1,
    }
  }
  const edge = row ? 'border-b border-border' : 'border-r border-border'
  return {
    className: cn(tableSegmentClass, row ? 'w-full' : 'h-full', !last && edge),
    style: row ? { height: size } : { width: size },
    tabIndex: 0,
  }
}

export function TableSegmentTrigger(props: TriggerProps): ReactNode {
  const { orientation, size: _size, last: _last, disabled, compactHandle, position, label, ...domProps } = props
  const row = orientation === 'row'
  return (
    <button
      {...domProps}
      type="button"
      {...triggerAppearance(props)}
      disabled={disabled}
      aria-label={label}
      aria-keyshortcuts={row ? undefined : 'Alt+F10'}
      data-table-control-column={row ? undefined : position}
      data-table-control-row={row ? position : undefined}
      data-table-active-handle={compactHandle?.selected}
      title={domProps.title ?? label}
      style={{
        ...triggerAppearance(props).style,
        touchAction: 'none',
        cursor: domProps['aria-description'] === undefined ? undefined : 'grab',
      }}
    >
      <TableGrip row={row} compact={compactHandle !== undefined} />
    </button>
  )
}

function TableGrip({ row, compact }: { row: boolean, compact: boolean }): ReactNode {
  if (!compact) {
    return row ? <MoreVertical size={14} aria-hidden="true" /> : <MoreHorizontal size={14} aria-hidden="true" />
  }
  return (
    <span className={cn(gripClass, row ? 'h-7 w-5' : 'h-5 w-7 translate-y-[22px]')}>
      <GripVertical size={14} className={row ? '' : 'rotate-90'} aria-hidden="true" />
    </span>
  )
}
