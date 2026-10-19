import type { ReactNode } from 'react'
import { SideMenuExtension } from '@blocknote/core/extensions'
import { AddBlockButton, SideMenu, SideMenuController, useDictionary, useExtensionState } from '@blocknote/react'
import { GripVertical } from 'lucide-react'
import { use } from 'react'
import { BlockActionsDrawer } from '@/features/editor/controls/block-actions/block-actions-drawer'
import { BlockActionsContext } from '@/features/editor/controls/block-actions/block-actions-model'
import { DesktopBlockActions } from '@/features/editor/controls/block-actions/desktop-block-actions'
import { SideMenuButton } from '@/features/editor/controls/block-actions/side-menu-button'
import { sideMenuPosition } from '@/features/editor/controls/block-actions/side-menu-position'
import { useCompactLayout } from '@/hooks/use-compact-layout'

export function EditorSideMenu(): ReactNode {
  const compact = useCompactLayout(700)
  const table = useExtensionState(SideMenuExtension, { selector: state => state?.block.type === 'table' })
  const position = sideMenuPosition(compact, table === true)
  return (
    <BlockActionsDrawer compact={compact}>
      <SideMenuController
        floatingUIOptions={{
          ...position,
          // Closing snapshots have no event bindings; remove block controls immediately.
          useTransitionStylesProps: { duration: 0 },
          useTransitionStatusProps: { duration: 0 },
        }}
        sideMenu={BlockSideMenu}
      />
    </BlockActionsDrawer>
  )
}

function BlockSideMenu(): ReactNode {
  const compact = useCompactLayout(700)
  return (
    <SideMenu>
      <AddBlockButton />
      {compact ? <MobileBlockMenuButton /> : <DesktopBlockActions />}
    </SideMenu>
  )
}

function MobileBlockMenuButton(): ReactNode {
  const actions = use(BlockActionsContext)
  const dictionary = useDictionary()
  const id = useExtensionState(SideMenuExtension, { selector: state => state?.block.id })
  return (
    <SideMenuButton
      label={dictionary.side_menu.drag_handle_label}
      icon={<GripVertical size={18} aria-hidden="true" />}
      aria-haspopup="dialog"
      aria-expanded={actions?.open ?? false}
      data-block-id={id}
      onPointerDown={(event) => {
        if (event.button === 0 && id !== undefined) {
          event.preventDefault()
          actions?.show(id)
        }
      }}
      onClick={() => {
        if (id !== undefined) {
          actions?.show(id)
        }
      }}
    />
  )
}
