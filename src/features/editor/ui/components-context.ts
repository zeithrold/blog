import type { ComponentProps } from '@blocknote/react'
import { createContext } from 'react'

type MenuSettings = Pick<
  ComponentProps['Generic']['Menu']['Root'],
  'portalElement' | 'position' | 'preventFocusOnOpen'
> & {
  recordKeyboardOpening?: (keyboard: boolean) => void
  isKeyboardOpening?: () => boolean
}
export const MenuContext = createContext<MenuSettings>({
  portalElement: null,
})
export const PopoverContext = createContext<
  Pick<ComponentProps['Generic']['Popover']['Root'], 'portalElement' | 'position'>
>({
  portalElement: null,
})
export function position(value?: string): {
  side: 'top' | 'right' | 'bottom' | 'left'
  align: 'start' | 'end' | 'center'
} {
  const [side, align] = (value ?? 'bottom').split('-')
  return {
    side: side === 'top' || side === 'right' || side === 'left' ? side : 'bottom',
    align: align === 'start' || align === 'end' ? align : 'center',
  }
}
export function preserveSelection(event: React.PointerEvent): void {
  if (event.button === 0 && event.pointerType !== 'touch') {
    event.preventDefault()
  }
}
