import type { ReactNode, RefObject } from 'react'
import type { BlockActionsModel } from '@/features/editor/ui/block-actions-model'
import type { EditorPopoverFocus } from '@/features/editor/ui/popover-focus'
import { SideMenuExtension } from '@blocknote/core/extensions'
import { useDictionary, useExtension, useExtensionState, usePortalElement } from '@blocknote/react'
import * as Popover from '@radix-ui/react-popover'
import { ArrowLeft, GripVertical, X } from 'lucide-react'
import { useRef } from 'react'
import { Button, useFrontendPreferences } from '@/components/ui/ztd-me/client'
import { usePortalContainer } from '@/components/ui/ztd-me/ui/portal'
import { BlockActionsList } from '@/features/editor/ui/block-actions-list'
import { useBlockActions } from '@/features/editor/ui/block-actions-model'
import { BlockColorGrid } from '@/features/editor/ui/block-color-grid'
import { useEditorPopoverBoundary } from '@/features/editor/ui/popover-boundary'
import { useEditorPopoverFocus } from '@/features/editor/ui/popover-focus'
import { SideMenuButton } from '@/features/editor/ui/side-menu'
import { useBlogTranslation } from '@/i18n/use-translation'

const layout1Class = [
  'editor-desktop-block-actions ztd-overlay ztd-menu blog-editor bn-root z-[150] grid',
  'max-w-[calc(100vw-2rem)] gap-2 rounded-xl border border-border bg-popover p-1.5 font-sans shadow-menu',
].join(' ')

export function DesktopBlockActions(): ReactNode {
  const model = useBlockActions(false)
  const focus = useEditorPopoverFocus(model.open, model.finishClose)
  const extension = useExtension(SideMenuExtension)
  const block = useExtensionState(SideMenuExtension, { selector: state => state?.block })
  const portal = usePortalElement()
  const inheritedPortal = usePortalContainer()
  const dictionary = useDictionary()
  const firstRef = useRef<HTMLButtonElement>(null)
  return (
    <Popover.Root
      open={model.open}
      onOpenChange={(open) => {
        if (open && block !== undefined) {
          model.context.show(block.id)
        }
        else { model.setOpen(false) }
      }}
    >
      <Popover.Trigger asChild>
        <SideMenuButton
          label={dictionary.side_menu.drag_handle_label}
          draggable
          data-test="dragHandle"
          icon={<GripVertical size={18} aria-hidden="true" />}
          onDragStart={(event) => {
            if (block !== undefined) {
              extension.blockDragStart(event, block)
            }
          }}
          onDragEnd={extension.blockDragEnd}
        />
      </Popover.Trigger>
      <Popover.Portal container={inheritedPortal ?? portal}>
        <DesktopActionsContent model={model} firstRef={firstRef} focus={focus} />
      </Popover.Portal>
    </Popover.Root>
  )
}
function DesktopActionsContent({ model, firstRef, focus }: {
  model: BlockActionsModel
  firstRef: RefObject<HTMLButtonElement | null>
  focus: EditorPopoverFocus
}): ReactNode {
  const dictionary = useDictionary()
  const text = useBlogTranslation('editor').t
  const { resolvedMode } = useFrontendPreferences()
  const boundary = useEditorPopoverBoundary(model.open)
  return (
    <Popover.Content
      side={model.block?.type === 'table' ? 'top' : 'left'}
      align={model.block?.type === 'table' ? 'end' : 'start'}
      sideOffset={8}
      collisionPadding={boundary}
      data-color-scheme={resolvedMode}
      className={[
        layout1Class,
        'w-60 max-h-[var(--radix-popover-content-available-height)] overflow-y-auto overscroll-contain',
      ].join(' ')}
      aria-label={dictionary.side_menu.drag_handle_label}
      {...focus}
      onOpenAutoFocus={(event) => {
        focus.onOpenAutoFocus(event)
        event.preventDefault()
        firstRef.current?.focus({ preventScroll: true })
      }}
    >
      {model.page === 'actions'
        ? <BlockActionsList model={model} firstRef={firstRef} />
        : (
            <>
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={text('back')}
                  onClick={() => model.setPage('actions')}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                </Button>
                <span className="text-sm font-medium">{dictionary.drag_handle.colors_menuitem}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={text('close')}
                  onClick={() => model.setOpen(false)}
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              </div>
              <BlockColorGrid model={model} />
            </>
          )}
    </Popover.Content>
  )
}
