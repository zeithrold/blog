import type { SideMenuController } from '@blocknote/react'

const desktopPosition = { useFloatingOptions: { placement: 'left-start' as const } }
const compactPosition: NonNullable<React.ComponentProps<typeof SideMenuController>['floatingUIOptions']> = {
  useFloatingOptions: {
    placement: 'bottom-start',
    middleware: [
      {
        name: 'blockGap',
        fn: ({ x, y, elements }) => {
          const reference = elements.reference instanceof Element
            ? elements.reference
            : elements.reference.contextElement
          if (reference === undefined) {
            return {}
          }
          let outer = reference.closest<HTMLElement>('.bn-block-outer')
          let ancestor = outer?.parentElement?.closest<HTMLElement>('.bn-block-outer')
          while (ancestor !== null && ancestor !== undefined) {
            outer = ancestor
            ancestor = outer.parentElement?.closest<HTMLElement>('.bn-block-outer')
          }
          if (outer === null) {
            return {}
          }
          // Nested blocks keep their compact spacing; their controls use the parent block's gap.
          const bounds = outer.getBoundingClientRect()
          const current = elements.reference.getBoundingClientRect()
          return {
            x: x + bounds.left - current.left,
            y: y + bounds.bottom - current.bottom + 2,
          }
        },
      },
    ],
  },
}
const desktopTablePosition = {
  useFloatingOptions: { placement: 'left-start' as const, middleware: [] },
}
const compactTablePosition: NonNullable<React.ComponentProps<typeof SideMenuController>['floatingUIOptions']> = {
  useFloatingOptions: {
    placement: 'top-end',
    middleware: [
      {
        name: 'tableToolbar',
        fn: ({ x, y, elements }) => {
          const reference = elements.reference instanceof Element
            ? elements.reference
            : elements.reference.contextElement
          const table = reference?.closest('.bn-block-outer')?.querySelector('table')
          const viewport = table?.closest('.tableWrapper-inner')
          if (table === null || table === undefined || viewport === null || viewport === undefined) {
            return {}
          }
          const current = elements.reference.getBoundingClientRect()
          const bounds = table.getBoundingClientRect()
          const visible = viewport.getBoundingClientRect()
          return {
            x: x + visible.left + Math.min(visible.width, bounds.width) - current.right,
            y: y + bounds.top - current.top - 44,
          }
        },
      },
    ],
  },
}

export function sideMenuPosition(compact: boolean, table: boolean): typeof compactPosition {
  if (compact) {
    return table ? compactTablePosition : compactPosition
  }
  return table ? desktopTablePosition : desktopPosition
}
