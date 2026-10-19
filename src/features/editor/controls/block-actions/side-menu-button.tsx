import type { ComponentProps } from '@blocknote/react'
import type { PointerEventHandler, ReactNode, RefObject } from 'react'
import { SideMenuExtension } from '@blocknote/core/extensions'
import { useExtension } from '@blocknote/react'
import { isValidElement, use, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/ztd-me/client'
import { MenuContext } from '@/features/editor/adapters/components-context'

type SideButtonProps = ComponentProps['SideMenu']['Button'] & {
  onPointerDown?: PointerEventHandler<HTMLButtonElement>
}

type BlockGesture = {
  pointerId: number | null
  dragging: boolean
  frozen: boolean
  mouseDown: boolean
  release: React.PointerEvent<HTMLButtonElement> | null
}

function emptyBlockGesture(): BlockGesture {
  return { pointerId: null, dragging: false, frozen: false, mouseDown: false, release: null }
}

function beginBlockPress(gesture: BlockGesture, pointerId: number | null, freeze: () => void): void {
  Object.assign(gesture, {
    pointerId,
    dragging: false,
    frozen: true,
    mouseDown: true,
    release: null,
  })
  freeze()
}

function completeBlockPress(
  event: React.PointerEvent<HTMLButtonElement>,
  gesture: BlockGesture,
  unfreeze: () => void,
): void {
  const { pointerId, dragging, mouseDown } = gesture
  gesture.pointerId = null
  gesture.mouseDown = false
  const startedHere = pointerId === event.pointerId || (event.pointerType === 'mouse' && mouseDown)
  if (!startedHere || dragging) {
    return
  }
  if (event.button === 0 && !event.ctrlKey) {
    gesture.release = event
  }
  else {
    gesture.frozen = false
    unfreeze()
  }
}

function useBlockPointerCleanup(
  draggable: SideButtonProps['draggable'],
  gestureRef: RefObject<BlockGesture>,
  unfreeze: () => void,
): void {
  useEffect(() => {
    if (draggable !== true) {
      return
    }
    const gesture = gestureRef.current
    const cancel = (): void => {
      gesture.pointerId = null
      gesture.mouseDown = false
      gesture.release = null
      // Native dragging cancels its pointer; keep the block frozen until dragend.
      if (!gesture.dragging && gesture.frozen) {
        gesture.frozen = false
        unfreeze()
      }
    }
    const release = (event: PointerEvent): void => {
      if (gesture.pointerId === event.pointerId || (event.pointerType === 'mouse' && gesture.mouseDown)) {
        cancel()
      }
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      window.removeEventListener('blur', cancel)
      if (gesture.frozen) {
        gesture.frozen = false
        unfreeze()
      }
    }
  }, [
    draggable,
    gestureRef,
    unfreeze,
  ])
}

type BlockPointerEvents
  = | 'onPointerDown'
    | 'onPointerUp'
    | 'onMouseDown'
    | 'onDragStart'
    | 'onDragEnd'
    | 'onClick'
type BlockPointerHandlers = Pick<React.ComponentProps<'button'>, BlockPointerEvents>

function useBlockPointer(
  { draggable, onPointerDown, onDragStart, onDragEnd, onClick }:
  Pick<SideButtonProps, 'draggable' | 'onPointerDown' | 'onDragStart' | 'onDragEnd' | 'onClick'>,
): BlockPointerHandlers {
  const menu = use(MenuContext)
  const sideMenu = useExtension(SideMenuExtension)
  const gestureRef = useRef<BlockGesture>(emptyBlockGesture())
  useBlockPointerCleanup(draggable, gestureRef, sideMenu.unfreezeMenu)
  return {
    onPointerDown: (event) => {
      if (draggable === true) {
        menu.recordKeyboardOpening?.(false)
        // Touch has no native HTML drag; preserve Radix's pointerdown focus handling.
        if (event.pointerType === 'touch') {
          onPointerDown?.(event)
          return
        }
        if (event.button === 0) {
          // Keep the starting block stable as the pointer moves toward the drop target.
          beginBlockPress(gestureRef.current, event.pointerId, sideMenu.freezeMenu)
        }
      }
      else {
        onPointerDown?.(event)
      }
    },
    onMouseDown: (event) => {
      // WebKit can omit the next pointerdown after a canceled native drag.
      if (draggable === true && event.button === 0 && !gestureRef.current.frozen) {
        menu.recordKeyboardOpening?.(false)
        beginBlockPress(gestureRef.current, null, sideMenu.freezeMenu)
      }
    },
    onPointerUp: event => completeBlockPress(event, gestureRef.current, sideMenu.unfreezeMenu),
    onClick: (event) => {
      const gesture = gestureRef.current
      const release = gesture.release
      gesture.release = null
      // Open after compatibility mouse focus completes, while retaining the native drag gesture.
      if (release !== null && onPointerDown !== undefined) {
        gesture.frozen = false
        onPointerDown(release)
      }
      onClick?.(event)
    },
    onDragStart: (event) => {
      gestureRef.current.dragging = true
      onDragStart?.(event)
    },
    onDragEnd: (event) => {
      Object.assign(gestureRef.current, emptyBlockGesture())
      onDragEnd?.(event)
      sideMenu.unfreezeMenu()
    },
  }
}

export function SideMenuButton({
  label,
  icon,
  children,
  className,
  onClick,
  onPointerDown,
  onDragStart,
  onDragEnd,
  ...rest
}: SideButtonProps): ReactNode {
  const pointer = useBlockPointer({
    draggable: rest.draggable,
    onPointerDown,
    onDragStart,
    onDragEnd,
    onClick,
  })
  // BlockNote's add action lives on its icon; activate it from the whole button.
  const action = isValidElement<{ onClick?: () => void }>(icon) ? icon.props.onClick : undefined
  return (
    <Button
      {...rest}
      {...pointer}
      type="button"
      variant="ghost"
      size="icon"
      className={`editor-side-button [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:shrink-0 ${className ?? ''}`}
      aria-label={label}
      title={label}
      onClickCapture={action === undefined
        ? undefined
        : (event) => {
            // Handle glyph clicks once, before the icon's own click handler.
            event.stopPropagation()
            onClick?.(event)
            action()
          }}
    >
      <span className="editor-side-glyph flex size-8 items-center justify-center rounded-md">
        {icon}
        {children}
      </span>
    </Button>
  )
}
