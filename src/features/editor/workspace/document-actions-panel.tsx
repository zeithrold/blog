import type { LucideIcon } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import { useRef } from 'react'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/ztd-me/client'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { useEditorLabels } from '@/i18n/use-labels'
import { GuardedLink } from '@/shared/admin/navigation-guard'

const template1Class = [
  'document-drawer-action [&.document-action-danger]:text-destructive justify-start gap-3 w-full',
  'min-h-13 py-[10px] px-3 text-left no-underline whitespace-normal [&_>_svg]:shrink-0',
].join(' ')

const utility1Class = [
  '[&_>_:is(.app-drawer-header,_.app-drawer-footer)]:shrink-0 [&_.app-drawer-header]:pb-3',
].join(' ')

const utility2Class = [
  'editor-menu document-action-menu p-1 border border-border rounded-[12px] bg-card',
  'text-foreground',
].join(' ')

const utility3Class = [
  '[&_[role=menuitem]]:items-center [&_[role=menuitem]]:gap-2 [&_[role=menuitem]]:min-h-11',
].join(' ')

const utility4Class = [
  '[&_[role=menuitem]]:py-2 [&_[role=menuitem]]:px-[10px] [&_[role=menuitem]]:rounded-[8px]',
].join(' ')

const utility5Class = ['[&_[role=menuitemcheckbox]]:px-[10px] [&_[role=menuitemcheckbox]]:rounded-[8px]'].join(' ')

const utility6Class = ['[&_[data-highlighted]]:[outline:none] z-[100] min-w-55 [&_[role=separator]]:h-px'].join(' ')

const utility7Class = ['document-drawer-action-copy grid gap-[2px] min-w-0 text-[length:14px] leading-[20px]'].join(' ')

const layout1Class = [
  'document-actions-drawer max-h-[calc(100dvh_-_24px)] overflow-hidden',
  utility1Class,
  '[&_.app-drawer-header]:text-left [&_.app-drawer-footer]:border-t',
  '[&_.app-drawer-footer]:border-border',
].join(' ')

const layout2Class = [
  utility2Class,
  'shadow-[0_12px_32px_var(--blog-shadow-overlay)] [&_[role=menuitem]]:flex',
  utility3Class,
  utility4Class,
  '[&_[role=menuitem]]:cursor-pointer [&_[role=menuitemcheckbox]]:flex',
  '[&_[role=menuitemcheckbox]]:items-center [&_[role=menuitemcheckbox]]:gap-2',
  '[&_[role=menuitemcheckbox]]:min-h-11 [&_[role=menuitemcheckbox]]:py-2',
  utility5Class,
  '[&_[role=menuitemcheckbox]]:cursor-pointer [&_[data-highlighted]]:bg-muted',
  utility6Class,
  '[&_[role=separator]]:m-1 [&_[role=separator]]:bg-border',
  '[&_.document-action-danger]:text-destructive',
].join(' ')

export type DocumentAction = {
  label: string
  icon: LucideIcon
  href?: string
  external?: boolean
  disabled?: boolean
  destructive?: boolean
  select?: () => boolean
}
type Props = {
  mobile: boolean
  open: boolean
  busy: boolean
  changeOpen: (open: boolean) => void
  afterClose: (event: Event) => void
  triggerRef: Ref<HTMLButtonElement>
  actions: DocumentAction[]
  description: string
}

export function DocumentActionsPanel({ triggerRef, ...props }: Props): ReactNode {
  const text = useEditorLabels()
  const closeRef = useRef<HTMLButtonElement>(null)
  const trigger = (
    <Button
      type="button"
      ref={triggerRef}
      variant="ghost"
      size="icon"
      aria-label={text('More document actions')}
      disabled={props.busy}
    >
      <MoreHorizontal size={20} aria-hidden="true" />
    </Button>
  )
  if (props.mobile) {
    return (
      <Drawer open={props.open} onOpenChange={props.changeOpen} autoFocus dismissible={!props.busy}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent
          className={layout1Class}
          onCloseAutoFocus={props.afterClose}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            closeRef.current?.focus()
          }}
        >
          <DrawerHeader>
            <DrawerTitle>{text('More document actions')}</DrawerTitle>
            <DrawerDescription>{props.description}</DrawerDescription>
          </DrawerHeader>
          <div
            className={[
              'document-drawer-actions grid gap-1 min-h-0 py-2 px-4 overflow-y-auto',
              '[overscroll-behavior:contain]',
            ].join(' ')}
            data-vaul-no-drag=""
          >
            {props.actions.map(action => <DrawerAction key={action.label} action={action} close={props.changeOpen} />)}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button ref={closeRef} type="button" variant="outline">{text('Close')}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Menu.Root open={props.open} onOpenChange={props.changeOpen} modal={false}>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className={layout2Class} align="end" sideOffset={8} onCloseAutoFocus={props.afterClose}>
          {props.actions.map(action => <MenuAction key={action.label} action={action} />)}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

function ActionCopy({ action }: { action: DocumentAction }): ReactNode {
  const Icon = action.icon
  return (
    <>
      <Icon size={18} aria-hidden="true" />
      <span className={utility7Class}>{action.label}</span>
    </>
  )
}

function DrawerAction({ action, close }: { action: DocumentAction, close: Props['changeOpen'] }): ReactNode {
  const className = cn(template1Class, action.destructive === true ? 'document-action-danger' : '')
  if (action.href !== undefined) {
    return (
      <Button variant="ghost" asChild className={className}>
        {action.external === true
          ? <ExternalAction action={action} onClick={() => close(false)} />
          : <GuardedLink href={action.href} onClick={() => close(false)}><ActionCopy action={action} /></GuardedLink>}
      </Button>
    )
  }
  return (
    <Button
      type="button"
      variant="ghost"
      className={className}
      disabled={action.disabled}
      onClick={() => action.select?.() !== false && close(false)}
    >
      <ActionCopy action={action} />
    </Button>
  )
}

function MenuAction({ action }: { action: DocumentAction }): ReactNode {
  const className = action.destructive === true ? 'document-action-danger' : undefined
  const select = (event: Event): void => {
    if (action.select?.() === false) {
      event.preventDefault()
    }
  }
  return (
    <Menu.Item asChild={action.href !== undefined} className={className} disabled={action.disabled} onSelect={select}>
      {menuItemContent(action)}
    </Menu.Item>
  )
}

/**
 * The menu item's child: a new-tab destination, a guarded in-app departure, or
 * plain content for an action this panel runs itself.
 */
function menuItemContent(action: DocumentAction): ReactNode {
  if (action.href === undefined) {
    return <ActionCopy action={action} />
  }
  if (action.external === true) {
    return <ExternalAction action={action} />
  }
  return <GuardedLink href={action.href}><ActionCopy action={action} /></GuardedLink>
}

/** A new-tab destination is not a departure from this document. */
function ExternalAction({ action, onClick }: { action: DocumentAction, onClick?: () => void }): ReactNode {
  return (
    <a href={action.href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
      <ActionCopy action={action} />
    </a>
  )
}
