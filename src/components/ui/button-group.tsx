'use client'

import type { ComponentProps } from 'react'
import { cn } from '@/components/ui/ztd-me/ui/cn'

const layout1Class = [
  'button-group isolate inline-flex w-fit items-stretch rounded-lg border border-border bg-surface',
  '[&>button]:relative [&>button]:rounded-none [&>button]:border-0',
  '[&>button:focus-visible]:z-10',
  'data-[orientation=horizontal]:[&>button:first-child]:rounded-l-[inherit]',
  'data-[orientation=horizontal]:[&>button:last-child]:rounded-r-[inherit]',
  'data-[orientation=vertical]:flex-col data-[orientation=vertical]:[&>button:first-child]:rounded-t-[inherit]',
  'data-[orientation=vertical]:[&>button:last-child]:rounded-b-[inherit]',
].join(' ')

export function ButtonGroup({
  orientation = 'horizontal',
  className,
  ...props
}: ComponentProps<'div'> & { orientation?: 'horizontal' | 'vertical' }): React.JSX.Element {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(layout1Class, className)}
      {...props}
    />
  )
}
