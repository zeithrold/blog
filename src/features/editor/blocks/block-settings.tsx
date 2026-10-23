import type { ReactNode } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/ztd-me/client'
import { usePortalContainer } from '@/components/ui/ztd-me/ui/portal'
import { useCompactLayout } from '@/hooks/use-compact-layout'
import { useBlogTranslation } from '@/i18n/use-translation'

const utility1Class = [
  'ztd-overlay ztd-menu z-[150] grid w-80 max-w-[calc(100vw-2rem)] gap-5 rounded-xl border',
  'border-border bg-popover',
].join(' ')

const layout1Class = [utility1Class, 'p-5 font-sans shadow-menu'].join(' ')

type SettingsProps = {
  title: string
  children: ReactNode
  disabled?: boolean
  initialOpen?: boolean
  trigger?: React.ReactElement
}
export function BlockSettings({
  title,
  children,
  disabled = false,
  initialOpen = false,
  trigger: customTrigger,
}: SettingsProps): ReactNode {
  const compact = useCompactLayout(700)
  const portal = usePortalContainer()
  const [open, setOpen] = useState(() => initialOpen && !disabled)
  const text = useBlogTranslation('editor').t
  const trigger = customTrigger ?? (
    <Button type="button" variant="ghost" size="icon" aria-label={title} disabled={disabled}>
      <Pencil size={16} aria-hidden="true" />
    </Button>
  )
  if (compact) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="max-h-[85dvh] font-sans">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription className="sr-only">{title}</DrawerDescription>
          </DrawerHeader>
          <div className="grid gap-5 overflow-auto px-5 py-3" data-vaul-no-drag="">{children}</div>
          <DrawerFooter><Button type="button" onClick={() => setOpen(false)}>{text('done')}</Button></DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal container={portal}>
        <Popover.Content side="bottom" align="end" sideOffset={8} className={layout1Class} aria-label={title}>
          <p className="text-sm font-medium">{title}</p>
          {children}
          <Button type="button" size="sm" onClick={() => setOpen(false)}>{text('done')}</Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
