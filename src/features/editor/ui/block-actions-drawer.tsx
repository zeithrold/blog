import type { KeyboardEvent, ReactNode, RefObject } from 'react'
import type { BlockActionsModel, BlockActionsProps } from '@/features/editor/ui/block-actions-model'
import { useDictionary } from '@blocknote/react'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef } from 'react'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { BlockActionsList } from '@/features/editor/ui/block-actions-list'
import { BlockActionsContext, useBlockActions } from '@/features/editor/ui/block-actions-model'
import { BlockColorGrid } from '@/features/editor/ui/block-color-grid'
import { useEditorLabels } from '@/i18n/use-labels'

const bodyClass = ['editor-block-drawer-body flex-1 min-h-0 overflow-y-auto overscroll-contain pt-0'].join(' ')

const headingClass = 'editor-block-drawer-heading flex items-center gap-2 [&_button]:size-11'

const layoutClass = [
  'editor-block-drawer blog-editor bn-root overflow-clip',
  '[&_[data-slot=drawer-handle]]:shrink-0 [&_[data-slot=drawer-header]]:shrink-0',
  '[&_[data-slot=drawer-footer]]:shrink-0',
].join(' ')

export function BlockActionsDrawer({ compact, children }: BlockActionsProps): ReactNode {
  const model = useBlockActions(compact)
  return (
    <BlockActionsContext value={model.context}>
      {children}
      <Drawer open={model.open} onOpenChange={model.setOpen}>
        <BlockDrawerContent model={model} />
      </Drawer>
    </BlockActionsContext>
  )
}

function BlockDrawerContent({ model }: { model: BlockActionsModel }): ReactNode {
  const text = useEditorLabels()
  const { resolvedMode } = useFrontendPreferences()
  const firstRef = useRef<HTMLButtonElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const colors = model.page === 'colors'
  useEffect(() => {
    if (model.open) {
      const target = colors ? backRef.current : firstRef.current
      target?.focus({ preventScroll: true })
    }
  }, [model.open, colors])
  return (
    <DrawerContent
      className={layoutClass}
      data-color-scheme={resolvedMode}
      onKeyDown={loopOptionTab}
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        firstRef.current?.focus({ preventScroll: true })
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        model.finishClose()
      }}
    >
      <BlockDrawerHeader model={model} backRef={backRef} />
      <div className={[bodyClass, 'pb-1'].join(' ')} data-vaul-no-drag="">
        {colors ? <BlockColorGrid model={model} /> : <BlockActionsList model={model} firstRef={firstRef} />}
      </div>
      <DrawerFooter className="border-t border-border pt-4">
        <DrawerClose asChild>
          <Button type="button" variant="outline" className="w-full">{text('Close')}</Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  )
}

function loopOptionTab(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.key !== 'Tab' || !event.altKey || event.ctrlKey || event.metaKey) {
    return
  }
  // Safari uses Option+Tab for buttons; Radix's native edge loop ignores that modifier.
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(
    'button:not([disabled]):not([aria-disabled=true]):not([tabindex="-1"])',
  ))
  const first = buttons.at(0)
  const last = buttons.at(-1)
  if (event.target === (event.shiftKey ? first : last)) {
    event.preventDefault()
    const target = event.shiftKey ? last : first
    target?.focus({ preventScroll: true })
  }
}

function BlockDrawerHeader({ model, backRef }: {
  model: BlockActionsModel
  backRef: RefObject<HTMLButtonElement | null>
}): ReactNode {
  const text = useEditorLabels()
  const dictionary = useDictionary()
  const colors = model.page === 'colors'
  return (
    <DrawerHeader>
      <div className={[headingClass, '[&_button]:-ml-2'].join(' ')}>
        {colors && (
          <Button
            ref={backRef}
            type="button"
            size="icon"
            variant="ghost"
            aria-label={text('Back')}
            onClick={() => model.setPage('actions')}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Button>
        )}
        <DrawerTitle>{colors ? dictionary.drag_handle.colors_menuitem : text('Block actions')}</DrawerTitle>
      </div>
      <DrawerDescription>
        {colors ? text('Choose text and background colors.') : text('Manage this block.')}
      </DrawerDescription>
    </DrawerHeader>
  )
}
