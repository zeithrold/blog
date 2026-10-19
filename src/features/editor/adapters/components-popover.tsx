import type { ComponentProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { use } from 'react'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { PopoverContext, position } from '@/features/editor/adapters/components-context'

const template1Class = [
  'editor-popover p-1 border border-border rounded-[12px] bg-card text-foreground',
  'shadow-[0_12px_32px_var(--blog-shadow-overlay)]',
].join(' ')

export function PopoverRoot({
  children,
  open,
  onOpenChange,
  ...settings
}: ComponentProps['Generic']['Popover']['Root']): ReactNode {
  return (
    <PopoverContext value={settings}>
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        {children}
      </Popover.Root>
    </PopoverContext>
  )
}
export function PopoverContent({
  children,
  className,
}: ComponentProps['Generic']['Popover']['Content']): ReactNode {
  const settings = use(PopoverContext)
  if (!(settings.portalElement !== null)) {
    return null
  }
  return (
    <Popover.Portal container={settings.portalElement}>
      <Popover.Content className={cn(template1Class, className ?? '')} {...position(settings.position)}>
        {children}
      </Popover.Content>
    </Popover.Portal>
  )
}
