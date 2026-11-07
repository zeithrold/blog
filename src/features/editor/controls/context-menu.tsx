import type { ComponentProps, ReactNode } from 'react'
import type { EditorContextModel } from '@/features/editor/controls/context-menu-model'
import type { Workspace } from '@/features/editor/workspace/editor-types'
import * as Menu from '@radix-ui/react-context-menu'
import { menuClass } from '@/components/ui/ztd-me/ui/classes'
import { ContextMenuItems } from '@/features/editor/controls/context-menu-items'
import { useEditorContextMenu } from '@/features/editor/controls/context-menu-model'
import { useBlogTranslation } from '@/i18n/use-translation'

export function EditorContextMenu({ workspace, portalElement, children }: {
  workspace: Workspace
  portalElement: HTMLElement | null
  children: ReactNode
}): ReactNode {
  const model = useEditorContextMenu(workspace)
  const text = useBlogTranslation('editor').t
  return (
    <Menu.Root modal={false} open={model.open} onOpenChange={model.setOpen}>
      <Menu.Trigger asChild disabled={!model.enabled} style={{ WebkitTouchCallout: 'default' }}>
        <ContextTriggerSurface
          prepare={model.prepare}
          className="contents"
          onPointerDownCapture={model.remember}
          onPointerUpCapture={model.release}
          onPointerCancelCapture={model.release}
          onKeyDown={model.key}
          onCompositionStartCapture={() => model.composition(true)}
          onCompositionEndCapture={() => model.composition(false)}
        >
          {children}
        </ContextTriggerSurface>
      </Menu.Trigger>
      <Menu.Portal container={portalElement ?? undefined}>
        <Menu.Content
          className={`${menuClass} editor-context-menu z-[160] w-64 max-w-[calc(100vw-24px)]`}
          collisionPadding={12}
          aria-label={text('editorContextMenu')}
          onCloseAutoFocus={model.close}
          onInteractOutside={model.outside}
          onKeyDown={model.clipboard}
        >
          {model.target !== null && <ContextMenuItems model={model} portalElement={portalElement} />}
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Label className="block px-3 py-2 text-help text-muted-foreground">
            {text('contextMenuClipboardHelp')}
          </Menu.Label>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}

function ContextTriggerSurface({ onContextMenu, prepare, ...props }: ComponentProps<'div'> & {
  prepare: EditorContextModel['prepare']
}): ReactNode {
  return (
    <div
      {...props}
      onContextMenuCapture={(event) => {
        prepare(event)
        if (event.isPropagationStopped()) {
          return
        }
        // Keep the captured selection and Radix's pointer anchor in the same event phase.
        onContextMenu?.(event)
        event.stopPropagation()
      }}
    />
  )
}
