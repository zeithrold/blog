import type { ComponentProps } from '@blocknote/react'
import type { ReactNode } from 'react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import { use, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/ztd-me/client'
import { menuClass, menuItemClass } from '@/components/ui/ztd-me/ui/classes'
import { cn } from '@/components/ui/ztd-me/ui/cn'
import { MenuContext, position } from '@/features/editor/adapters/components-context'
import { useMenuItemIcon } from '@/features/editor/adapters/menu-item-icon'

const utility1Class = [
  'editor-menu-item-icon inline-flex flex-[0_0_18px] items-center justify-center w-[18px]',
].join(' ')

export function MenuRoot({
  sub,
  children,
  onOpenChange,
  portalElement,
  position: menuPosition,
  preventFocusOnOpen,
}: ComponentProps['Generic']['Menu']['Root']): ReactNode {
  const keyboardOpeningRef = useRef(false)
  const settings = useMemo(() => ({
    portalElement,
    position: menuPosition,
    preventFocusOnOpen,
    recordKeyboardOpening: (keyboard: boolean) => { keyboardOpeningRef.current = keyboard },
    isKeyboardOpening: () => keyboardOpeningRef.current,
  }), [
    portalElement,
    menuPosition,
    preventFocusOnOpen,
  ])
  return (
    <MenuContext value={settings}>
      {sub === true
        ? (
            <Menu.Sub onOpenChange={onOpenChange}>{children}</Menu.Sub>
          )
        : (
            <Menu.Root onOpenChange={onOpenChange} modal={false}>
              {children}
            </Menu.Root>
          )}
    </MenuContext>
  )
}
export function MenuDropdown({
  sub,
  className,
  children,
}: ComponentProps['Generic']['Menu']['Dropdown']): ReactNode {
  const settings = use(MenuContext)
  if (!(settings.portalElement !== null)) {
    return null
  }
  const cls = cn(menuClass, 'editor-menu z-[150] w-56 max-w-[calc(100vw-2rem)] outline-none', className)
  const entry = menuEntry(settings)
  return (
    <Menu.Portal container={settings.portalElement}>
      {sub === true
        ? (
            <Menu.SubContent className={cls} {...entry}>
              {children}
            </Menu.SubContent>
          )
        : (
            <Menu.Content
              className={cls}
              {...position(settings.position)}
              {...entry}
              onCloseAutoFocus={(event) => {
                if (settings.preventFocusOnOpen === true) {
                  event.preventDefault()
                }
              }}
            >
              {children}
            </Menu.Content>
          )}
    </Menu.Portal>
  )
}

function focusMenuItem(element: HTMLElement, last = false): void {
  const items = Array.from(element.querySelectorAll<HTMLElement>(
    '[role^="menuitem"]:not([data-disabled]):not([aria-disabled=true])',
  ))
  items.at(last ? -1 : 0)?.focus({ preventScroll: true })
}

function menuEntry(settings: React.ContextType<typeof MenuContext>):
Pick<React.ComponentProps<typeof Menu.Content>, 'onFocus' | 'onKeyDown'> {
  return {
    onFocus: (event) => {
      if (event.target !== event.currentTarget) {
        return
      }
      // Native block removal can leave stale Radix collection refs during entry.
      event.preventDefault()
      if (settings.preventFocusOnOpen !== true && settings.isKeyboardOpening?.() === true) {
        focusMenuItem(event.currentTarget)
      }
    },
    onKeyDown: (event) => {
      if (event.target !== event.currentTarget || ![
        'ArrowDown',
        'ArrowUp',
        'Home',
        'End',
      ].includes(event.key)) {
        return
      }
      event.preventDefault()
      settings.recordKeyboardOpening?.(true)
      focusMenuItem(event.currentTarget, event.key === 'ArrowUp' || event.key === 'End')
    },
  }
}
export function MenuItem({
  subTrigger,
  checked,
  className,
  children,
  icon,
  onClick,
  'data-test': dataTest,
}: ComponentProps['Generic']['Menu']['Item'] & { 'data-test'?: string }): ReactNode {
  const itemClass = cn(menuItemClass, className)
  const itemIcon = useMenuItemIcon(children, icon)
  const glyph = itemIcon === undefined || itemIcon === null
    ? null
    : (
        <span className={[utility1Class, 'h-[18px]'].join(' ')} aria-hidden="true">
          {itemIcon}
        </span>
      )
  if (subTrigger === true) {
    return (
      <Menu.SubTrigger className={itemClass} data-test={dataTest}>
        {glyph}
        {children}
      </Menu.SubTrigger>
    )
  }
  if (checked !== undefined) {
    return (
      <Menu.CheckboxItem className={itemClass} checked={checked} onSelect={onClick} data-test={dataTest}>
        <Menu.ItemIndicator className="absolute right-2" aria-hidden="true"><Check size={16} /></Menu.ItemIndicator>
        {glyph}
        {children}
      </Menu.CheckboxItem>
    )
  }
  return (
    <Menu.Item className={itemClass} onSelect={onClick} data-test={dataTest}>
      {glyph}
      {children}
    </Menu.Item>
  )
}
export function MenuTrigger({
  sub,
  children,
}: ComponentProps['Generic']['Menu']['Trigger']): ReactNode {
  const settings = use(MenuContext)
  const intent = {
    onKeyDown: () => settings.recordKeyboardOpening?.(true),
    onPointerDown: () => settings.recordKeyboardOpening?.(false),
  }
  return sub === true
    ? (
        <Menu.SubTrigger asChild {...intent}>{children}</Menu.SubTrigger>
      )
    : (
        <Menu.Trigger asChild {...intent}>{children}</Menu.Trigger>
      )
}
export function MenuButton({
  label,
  icon,
  children,
  className,
  ...rest
}: ComponentProps['Generic']['Menu']['Button']): ReactNode {
  const compact = className?.includes('bn-table-cell-handle') === true
  return (
    <Button
      variant="outline"
      size={compact ? 'icon-xs' : 'sm'}
      {...rest}
      type="button"
      className={cn(compact ? 'min-w-8' : '', className)}
      aria-label={label}
    >
      {icon}
      {children}
    </Button>
  )
}
