/* eslint-disable style/max-len -- Verbatim case references stay on one line. */
/* eslint-disable max-lines -- One flat table maps every table case to its replacement. */
import type { AdminMigrationRecord } from './admin-migrations'
import { tableInteractionMigrations } from './table-interaction-migrations'

/**
 * Where the retired table browser cases now run.
 *
 * `legacy` names the E2E case that owned the assertion, `component` names the
 * component browser case that proves it on the production editor entry (real
 * BlockNote table, controller and draft coordinator), and `proves` lists the
 * original assertions the replacement covers. Every component case asserts the
 * revision packet the editor sent; a case never reads a Worker snapshot. The
 * stored copy, canonical widths and the actual save/reload journey stay with the
 * Worker tests and the retained cases below.
 *
 * Control inventory affected by the retired E2E files: `editor/tables/table-width-limits`
 * and `editor/tables/table-keyboard-controls` were retired whole, and
 * `editor/tables/table-drag` now holds only CDP-skip touch cases, so it was
 * removed from the evidence list. The `tables` surface row names the component
 * specs that replace them; `table-overlay-polish` (slash) and `table-caption`
 * (390px) remain as evidence files.
 *
 * Remaining E2E table cases: caption and formatting at 390px, the slash
 * save/reload representative, and the CDP physical-touch sessions (the
 * component reporter has no approved skip policy for them).
 */

const F = {
  overlay: 'tests/browser/editor/tables/table-overlay-polish.spec.ts',
  keyboard: 'tests/browser/editor/tables/table-keyboard-controls.spec.ts',
  caption: 'tests/browser/editor/tables/table-caption.spec.ts',
  widths: 'tests/browser/editor/tables/table-width-limits.spec.ts',
  formatting: 'tests/browser/editor/tables/formatting-table-position.spec.ts',
  drag: 'tests/browser/editor/tables/table-drag.spec.ts',
  dragEdges: 'tests/browser/editor/tables/table-drag-edges.spec.ts',
  options: 'tests/components/specs/editor-tables.spec.ts',
  insertion: 'tests/components/specs/editor-table-insertion.spec.ts',
  keys: 'tests/components/specs/editor-table-keyboard.spec.ts',
  captions: 'tests/components/specs/editor-table-caption.spec.ts',
  layout: 'tests/components/specs/editor-table-layout.spec.ts',
  dragTable: 'tests/components/specs/editor-table-drag.spec.ts',
  mobileTable: 'tests/components/specs/editor-table-mobile.spec.ts',
} as const

function c(file: string, title: string): string {
  return `${file} :: ${title}`
}

export const tableMigrations: readonly AdminMigrationRecord[] = [
  {
    id: 'editor.tables-overlay',
    legacy: [
      c(F.overlay, 'table bars keep row and column menu changes through save and reload'),
      c(F.overlay, 'table column insertion covers every boundary and Undo restores cells'),
      c(F.overlay, 'table row insertion covers every boundary and Undo restores cells'),
      c(F.overlay, 'the last table row and column cannot be deleted from the options menus'),
      c(F.overlay, 'native column resizing saves widths and Undo restores the original table'),
    ],
    component: [
      {
        case: c(F.options, 'table option menus add and delete rows and columns and keep the bar geometry'),
        proves: [
          'bars, custom grips and the block action group keep their measured geometry and states',
          'adding a row and column reaches the revision packet with the expected cells',
          'deleting the added row and column returns the original cells',
          'the block menu stays clear of the controls and inside the viewport',
        ],
      },
      {
        case: c(F.insertion, 'table column insertion at every boundary saves and Undo restores the cells'),
        proves: [
          'the hover insert control names and inserts at each of the three boundaries',
          'the packet carries the empty inserted cells and every other cell unchanged',
          'one Undo restores the two-by-two cells after every boundary',
        ],
      },
      {
        case: c(F.insertion, 'table row insertion at every boundary saves and Undo restores the cells'),
        proves: [
          'the hover insert control names and inserts at each of the three boundaries',
          'the packet carries the empty inserted row and every existing row unchanged',
          'one Undo restores the two-by-two cells after every boundary',
        ],
      },
      {
        case: c(F.insertion, 'the last table row and column cannot be deleted from the option menus'),
        proves: [
          'the only row and column offer a disabled delete item in their menus',
          'the menu action sends no revision and leaves one cell',
        ],
      },
      {
        case: c(F.options, 'native column resizing saves widths and Undo restores the original table'),
        proves: [
          'the native handle shows the resize cursor and adds about 40px to the rendered cell',
          'the packet carries that explicit first width while the other widths and cells stay unchanged',
          'one Undo restores the rendered width, the packet widths and the cells',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.tables-width-limits',
    legacy: [
      c(F.widths, 'native minimum column width saves and remains one Undo'),
      c(F.widths, 'native maximum column width saves and remains one Undo'),
    ],
    component: [
      {
        case: c(F.options, 'native minimum and maximum column widths save and remain one Undo'),
        proves: [
          'the minimum and maximum drags clamp the first column to its saved bound',
          'each clamped width reaches a revision packet while the other widths stay explicit or unset',
          'one Undo restores 120px and Redo returns the clamped width',
          'the no-overflow and idle alert state survives both boundaries',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.tables-keyboard',
    legacy: [
      c(F.keyboard, 'real cell keys reach the current table column and row controls at 1440px'),
      c(F.keyboard, 'real cell keys reach the current table column and row controls at 320px'),
      c(F.keyboard, 'keyboard column operations use native save and one Undo in the current table'),
      c(F.keyboard, 'pending operations reject the table control shortcut in the read-only editor'),
    ],
    component: [
      {
        case: c(F.keys, 'cell keys reach the current table column and row controls at 1440px'),
        proves: [
          'Tab and Shift+Tab move the caret between cells while the body keeps focus',
          'Alt+F10 focuses the column control for the current cell and Escape returns the caret',
          'Tab reaches the row control and both menus stay inside the viewport',
          'the whole navigation session sends no revision',
        ],
      },
      {
        case: c(F.keys, 'cell keys reach the current table column and row controls at 320px'),
        proves: [
          'Tab and Shift+Tab move the caret between cells while the body keeps focus',
          'Alt+F10 focuses the column control for the current cell and Escape returns the caret',
          'Tab reaches the compact row control and both menus stay inside the viewport',
          'the whole navigation session sends no revision',
        ],
      },
      {
        case: c(F.keys, 'keyboard column insertion saves one revision and Undo restores the table'),
        proves: [
          'the focused menu adds a column to the current table only',
          'the revision packet carries the inserted empty cells and leaves the other table unchanged',
          'one Undo restores the table and the packet equals the opened body',
        ],
      },
      {
        case: c(F.keys, 'pending operations reject the table control shortcut in the read-only editor'),
        proves: [
          'Publish is held by the case and the real editor turns read-only while the request is pending',
          'Alt+F10 cannot focus a column control or open a table menu in that state',
          'the held request sends no revision and the editor becomes editable again when it is answered',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.tables-caption',
    legacy: [
      c(F.caption, 'each table has an independent caption below its viewport at 1440px'),
      c(F.caption, 'Chinese caption controls focus the input and close on blur or Escape'),
    ],
    component: [
      {
        case: c(F.captions, 'each table has an independent caption below its viewport at 1440px'),
        proves: [
          'two tables keep independent captions below their own viewport',
          'each caption reaches the revision packet without changing the blocks',
          'clearing one caption leaves the other caption in the packet',
          'the Content inspector exposes no table caption field',
        ],
      },
      {
        case: c(F.captions, 'Chinese caption controls focus the input and close on blur or Escape'),
        proves: [
          'the Chinese caption button, input name and placeholder focus the field',
          'Escape returns focus to the caption button and blur closes the field',
          'the committed caption reaches the revision packet',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c(F.caption, 'each table has an independent caption below its viewport at 390px'),
        ],
        reason: 'The compact case stays the save/reload representative: it reads the stored captions back from the Worker at 390px.',
      },
    ],
  },
  {
    id: 'editor.tables-formatting',
    legacy: [
      c(F.formatting, 'table formatting preserves its range below the selection at 1440px'),
    ],
    component: [
      {
        case: c(F.keys, 'table formatting preserves its range below the selection at 1440px'),
        proves: [
          'the selected First range keeps the formatting toolbar inside the viewport below it',
          'Italic reaches the revision packet for only the selected range',
          'the cell renders the saved italic run and the next cell is unchanged',
        ],
      },
    ],
    retained: [
      {
        cases: [
          c(F.formatting, 'table formatting preserves its range below the selection at 390px'),
        ],
        reason: 'The compact case stays the save/reload representative for the 390px toolbar placement and stored italic range.',
      },
    ],
  },
  {
    id: 'editor.tables-alignment',
    legacy: [
      c('tests/browser/editor/tables/table-content-alignment.spec.ts', 'table aligns with paragraph, code and formula while desktop controls toggle'),
      c('tests/browser/editor/tables/table-content-alignment.spec.ts', 'mobile table aligns at 390 and 320px with its controls outside the body'),
    ],
    component: [
      {
        case: c(F.layout, 'table aligns with paragraph, code and formula while desktop controls toggle'),
        proves: [
          'the table, paragraph, code and formula share the same left content edge',
          'hidden and shown controls keep the same layout, and the menu opens inside the viewport',
          'toggling controls at 1440px and the 701px boundary sends no revision',
        ],
      },
      {
        case: c(F.layout, 'mobile table aligns at 390 and 320px with its controls outside the body'),
        proves: [
          'the table and its peers keep their edges at 390px and 320px with controls outside the body',
          'the scrollbar End/Home moves the wide table without moving the layout',
          'the compact row grips keep 44px targets and no revision is sent',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.tables-scrollbar',
    legacy: [
      c(F.overlay, 'wide table thumb drag and keyboard scrolling work at 1440px'),
      c(F.overlay, 'wide table thumb drag and keyboard scrolling work at 390px'),
    ],
    component: [
      {
        case: c(F.layout, 'wide table thumb drag and keyboard scrolling work at 1440 and 390px'),
        proves: [
          'the thumb drag scrolls the wide table and the scrollbar reports the position',
          'Home, ArrowRight, ArrowLeft and End move the table scroll position',
          'the offscreen column menu adds an empty column to the packet and one Undo restores eight columns',
          'the 1440px focus move and the 390px touched column keep the last column reachable',
          'both widths stay inside the viewport',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.tables-mobile',
    legacy: [
      c(F.overlay, 'mobile table grips stay reachable with block actions above the table'),
      c('tests/browser/editor/tables/table-mobile-grips.spec.ts', 'mobile table grips follow the touched cell at 320px'),
      c('tests/browser/editor/tables/table-mobile-grips.spec.ts', 'mobile table grips follow the touched cell at 390px'),
      c('tests/browser/editor/tables/table-mobile-grips.spec.ts', 'mobile table grips follow the touched cell at 486px'),
    ],
    component: [
      {
        case: c(F.layout, 'mobile table grips stay reachable with block actions above the table'),
        proves: [
          'the block action group and both grips keep their measured compact geometry',
          'the block action dialog is inside the viewport and Escape keeps the table visible',
          'reading the compact controls sends no revision',
        ],
      },
      {
        case: c(F.mobileTable, 'mobile table grips follow the touched cell at 320px'),
        proves: [
          'the touched cell selects its row and column grips at 44px',
          'the grip sits on the table edge and the active handle stays in view',
          'Add column right and Delete row reach the packet and the compact table keeps its bounds',
        ],
      },
      {
        case: c(F.mobileTable, 'mobile table grips follow the touched cell at 390px'),
        proves: [
          'the touched cell selects its row and column grips at 44px',
          'the grip sits on the table edge and the active handle stays in view',
          'Add column right and Delete row reach the packet and the compact table keeps its bounds',
        ],
      },
      {
        case: c(F.mobileTable, 'mobile table grips follow the touched cell at 486px'),
        proves: [
          'the touched cell selects its row and column grips at 44px',
          'the grip sits on the table edge and the active handle stays in view',
          'Add column right and Delete row reach the packet and the compact table keeps its bounds',
        ],
      },
    ],
    retained: [],
  },
  {
    id: 'editor.tables-mouse-drag',
    legacy: [
      c(F.drag, 'desktop row drag saves only on drop, undoes once and reloads'),
      c(F.drag, 'desktop column drag saves only on drop, undoes once and reloads'),
      c(F.drag, 'Escape and releasing outside cancel without adding history'),
      c(F.dragEdges, 'column widths travel with their column and headers keep their region'),
      c(F.dragEdges, 'merged row groups prevent splitting but allow safe drops'),
      c(F.dragEdges, 'merged column groups prevent splitting but allow safe drops'),
      c(F.dragEdges, 'row drag scrolls the page and cancels without moving content'),
      c(F.overlay, 'mouse clicks insert a middle column and row and Undo keeps the original cells'),
    ],
    component: [
      {
        case: c(F.dragTable, 'desktop row and column drag saves only on drop and Undo restores the order'),
        proves: [
          'a drag shows the drop boundary and sends no revision before release',
          'the drop reorders only the dragged row/column and keeps every column width',
          'one Undo restores the opened order and Redo reapplies the moved order',
        ],
      },
      {
        case: c(F.dragTable, 'Escape and releasing outside cancel without adding history'),
        proves: [
          'Escape and releasing outside both clear the preview',
          'neither cancel adds history or sends a revision',
        ],
      },
      {
        case: c(F.dragTable, 'column widths travel with their column and headers keep their region'),
        proves: [
          'the header row and column cannot be dragged',
          'an invalid drop sends nothing; a valid move carries its width to the new position',
          'the packet keeps headerRows and headerCols at 1 and the first cell text',
        ],
      },
      {
        case: c(F.dragTable, 'merged row groups prevent splitting but allow safe drops'),
        proves: [
          'moving a merged row into its own group is invalid and sends no revision',
          'a safe drop keeps the two-cell span and its First cell text',
        ],
      },
      {
        case: c(F.dragTable, 'merged column groups prevent splitting but allow safe drops'),
        proves: [
          'moving a merged column into its own group is invalid and sends no revision',
          'a safe drop keeps the two-cell span and its First cell text',
        ],
      },
      {
        case: c(F.dragTable, 'mouse clicks insert a middle column and row and Undo keeps the original cells'),
        proves: [
          'the hover insert at position 2 adds a middle column or row and the packet carries the empty cells',
          'the other rows and columns keep their text',
          'one Undo restores both rows and columns',
        ],
      },
      {
        case: c(F.mobileTable, 'row drag scrolls the page and cancels without moving content'),
        proves: [
          'dragging a row to the viewport edge scrolls the page without a save',
          'Escape cancels the drag and sends no revision',
        ],
      },
    ],
    retained: [],
  },
  ...tableInteractionMigrations,
]
