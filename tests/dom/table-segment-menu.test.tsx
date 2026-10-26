import type { ReactNode } from 'react'
import type { TableEditor, TableTarget } from '@/features/editor/blocks/table/table-controls-model'
import type { SegmentProps } from '@/features/editor/blocks/table/table-segment-menu'
import { BlockNoteEditor } from '@blocknote/core'
import { en } from '@blocknote/core/locales'
import { BlockNoteViewRaw } from '@blocknote/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { createPreferencePolicy } from '@/components/ui/ztd-me'
import { useTableTargets } from '@/features/editor/blocks/table/table-controls-model'
import { useTableDrag } from '@/features/editor/blocks/table/table-drag-controls'
import { useTableKeyboardControls } from '@/features/editor/blocks/table/table-keyboard-controls'
import { tableAxisSpan } from '@/features/editor/blocks/table/table-operations'
import { TableSegmentMenu } from '@/features/editor/blocks/table/table-segment-menu'
import { editorSchema } from '@/features/editor/engine/schema'
import { BlogFrontend } from '@/i18n/frontend'
import { click, one } from './dom'
import { installBrowserShims, setMediaState } from './environment'

const policy = createPreferencePolicy({
  name: 'blog.dom.table-segment-menu.v1',
  secure: false,
})

const tableId = '33333333-3333-4333-8333-333333333333'

type Scenario = 'single' | 'merged-row' | 'merged-column'

type TableCell = {
  type: 'tableCell'
  props: { colspan: number, rowspan: number, backgroundColor: 'default' }
  content: string
}

type TableContent = {
  columnWidths: number[]
  rows: { cells: TableCell[] }[]
}

function cell(content: string, spans: { colspan?: number, rowspan?: number } = {}): TableCell {
  return {
    type: 'tableCell' as const,
    props: {
      colspan: spans.colspan ?? 1,
      rowspan: spans.rowspan ?? 1,
      backgroundColor: 'default' as const,
    },
    content,
  }
}

function initialContent(scenario: Scenario) {
  let content: TableContent
  switch (scenario) {
    case 'single': {
      content = {
        columnWidths: [120],
        rows: [
          {
            cells: [
              cell('Only cell'),
            ],
          },
        ],
      }
      break
    }
    case 'merged-row': {
      content = {
        columnWidths: [120, 120],
        rows: [
          {
            cells: [
              cell('Merged rows', { rowspan: 2 }),
              cell('First row peer'),
            ],
          },
          {
            cells: [
              cell('Second row peer'),
            ],
          },
        ],
      }
      break
    }
    case 'merged-column': {
      content = {
        columnWidths: [120, 120],
        rows: [
          {
            cells: [
              cell('Merged columns', { colspan: 2 }),
            ],
          },
        ],
      }
      break
    }
  }
  return [
    {
      id: tableId,
      type: 'table' as const,
      content: { type: 'tableContent' as const, ...content },
    },
  ]
}

function TableMenus({ editor }: { editor: TableEditor }): ReactNode {
  const targets = useTableTargets(editor)
  const target = targets[0]
  return target === undefined
    ? null
    : (
        <>
          <SegmentMenu editor={editor} target={target} orientation="row" />
          <SegmentMenu editor={editor} target={target} orientation="column" />
        </>
      )
}

function SegmentMenu({
  editor,
  target,
  orientation,
}: Pick<SegmentProps, 'editor' | 'target' | 'orientation'>): ReactNode {
  const keyboard = useTableKeyboardControls(editor, [target], false)
  const drag = useTableDrag(editor, target, { disabled: false, overlay: null })
  const count = axisCount(target, orientation)
  const span = tableAxisSpan(target, orientation, 0)
  const row = orientation === 'row'
  const firstRow = target.table.rows.item(0)
  const size = row
    ? firstRow?.getBoundingClientRect().height ?? 0
    : firstRow?.cells.item(0)?.getBoundingClientRect().width ?? 0
  const props: SegmentProps = {
    editor,
    target,
    orientation,
    index: 0,
    position: 0,
    count,
    size,
    last: span === count,
    disabled: false,
    portalElement: document.body,
    keyboard,
    drag,
    onOpenChange: () => {},
  }
  return <TableSegmentMenu {...props} />
}

function axisCount(target: TableTarget, orientation: SegmentProps['orientation']): number {
  if (orientation === 'row') {
    return target.table.rows.length
  }
  const columns = target.table.querySelectorAll('col').length
  if (columns > 0) {
    return columns
  }
  const firstRowCells = Array.from(target.table.rows.item(0)?.cells ?? [])
  return firstRowCells.reduce((count, tableCell) => count + Math.max(1, tableCell.colSpan), 0)
}

function BlockNoteSurface({ editor }: {
  editor: typeof editorSchema.BlockNoteEditor
}): ReactNode {
  return (
    <BlogFrontend initialPreferences={{ version: 1, mode: 'light', palette: 'neutral', locale: 'en' }} policy={policy}>
      <BlockNoteViewRaw
        editor={editor}
        editable
        comments={false}
        emojiPicker={false}
        slashMenu={false}
        sideMenu={false}
        filePanel={false}
        formattingToolbar={false}
        linkToolbar={false}
        tableHandles={false}
      >
        <TableMenus editor={editor} />
      </BlockNoteViewRaw>
    </BlogFrontend>
  )
}

async function nextFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  })
}

async function mountTableMenu(scenario: Scenario): Promise<{
  container: HTMLDivElement
  unmount: () => void
}> {
  installBrowserShims()
  setMediaState({ width: 1440, dark: false })
  const editor: typeof editorSchema.BlockNoteEditor = BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: initialContent(scenario),
    dictionary: en,
  })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(<BlockNoteSurface editor={editor} />)
  })
  await nextFrame()
  await nextFrame()

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

async function openMenu(container: ParentNode, label: string): Promise<HTMLElement> {
  const trigger = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    .find(button => button.getAttribute('aria-label') === label)
  if (trigger === undefined) {
    throw new Error(`No table segment control was labelled "${label}"`)
  }
  await act(async () => {
    click(trigger)
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  })
  return one(document.body, '[role="menu"]')
}

async function closeMenu(menu: HTMLElement): Promise<void> {
  await act(async () => {
    menu.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }))
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

function deleteItem(menu: ParentNode, label: string): HTMLElement {
  const item = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .find(entry => entry.textContent.trim() === label)
  if (item === undefined) {
    throw new Error(`No table menu item was labelled "${label}"`)
  }
  return item
}

it('last row and column menus expose their labels and disabled delete items', async () => {
  const view = await mountTableMenu('single')
  try {
    const rowMenu = await openMenu(view.container, 'Row 1 options')
    expect(deleteItem(rowMenu, 'Delete row').getAttribute('aria-disabled')).toBe('true')
    await closeMenu(rowMenu)

    const columnMenu = await openMenu(view.container, 'Column 1 options')
    expect(deleteItem(columnMenu, 'Delete column').getAttribute('aria-disabled')).toBe('true')
  }
  finally {
    view.unmount()
  }
})

it('a merged row menu labels the full group and disables deletion', async () => {
  const view = await mountTableMenu('merged-row')
  try {
    const menu = await openMenu(view.container, 'Rows 1–2 options')
    expect(deleteItem(menu, 'Delete row').getAttribute('aria-disabled')).toBe('true')
  }
  finally {
    view.unmount()
  }
})

it('a merged column menu labels the full group and disables deletion', async () => {
  const view = await mountTableMenu('merged-column')
  try {
    const menu = await openMenu(view.container, 'Columns 1–2 options')
    expect(deleteItem(menu, 'Delete column').getAttribute('aria-disabled')).toBe('true')
  }
  finally {
    view.unmount()
  }
})
