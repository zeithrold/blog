import type { Dictionary } from '@blocknote/core'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useDictionary } from '@blocknote/react'
import {
  ArrowDownFromLine,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  ArrowUpFromLine,
  Palette,
  PanelLeft,
  PanelTop,
  TableCellsSplit,
  Trash2,
} from 'lucide-react'

// Native menu items expose their translated label rather than an action ID.
// Match the current editor dictionary; existing icons and color swatches win.
export function useMenuItemIcon(children: ReactNode, icon: ReactNode): ReactNode {
  const dictionary = useDictionary()
  if (icon !== undefined && icon !== null) {
    return icon
  }
  const Icon = actionIcon(dictionary, children)
  return Icon === undefined ? undefined : <Icon size={18} aria-hidden="true" />
}

function actionIcon(dictionary: Dictionary, label: ReactNode): LucideIcon | undefined {
  if (typeof label !== 'string') {
    return undefined
  }
  const { drag_handle: block, table_handle: table } = dictionary
  const icons: [string, LucideIcon][] = [
    [block.delete_menuitem, Trash2],
    [block.colors_menuitem, Palette],
    [block.header_row_menuitem, PanelTop],
    [block.header_column_menuitem, PanelLeft],
    [table.delete_row_menuitem, Trash2],
    [table.delete_column_menuitem, Trash2],
    [table.add_above_menuitem, ArrowUpFromLine],
    [table.add_below_menuitem, ArrowDownFromLine],
    [table.add_left_menuitem, ArrowLeftFromLine],
    [table.add_right_menuitem, ArrowRightFromLine],
    [table.split_cell_menuitem, TableCellsSplit],
    [table.background_color_menuitem, Palette],
  ]
  return icons.find(([text]) => text === label)?.[1]
}
